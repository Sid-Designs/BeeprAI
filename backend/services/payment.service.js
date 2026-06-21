import crypto from "node:crypto";
import Razorpay from "razorpay";
import Tenant from "../models/tenant.model.js";
import Organization from "../models/organization.model.js";
import Payment from "../models/payment.model.js";
import { getPaymentPlan } from "../config/paymentPlans.js";
import { AppError } from "../utils/AppError.js";
import { toAppError } from "../utils/errorMessage.js";

/** Razorpay receipt max length is 40 characters. */
function buildOrderReceipt(plan) {
  const receipt = `bpr-${plan}-${Date.now().toString(36)}`;
  return receipt.length <= 40 ? receipt : receipt.slice(0, 40);
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new AppError("Payment provider is not configured.", 503, "PAYMENTS_DISABLED");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function getPaymentConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    return { enabled: false };
  }

  return {
    enabled: true,
    keyId,
    currency: "INR",
    upiId: process.env.UPI_ID || "",
    upiPayeeName: process.env.UPI_PAYEE_NAME || "",
    plans: {
      pro: getPaymentPlan("pro"),
      enterprise: getPaymentPlan("enterprise"),
    },
  };
}

export async function createPlanOrder({ tenantId, userId, organizationId, plan }) {
  const planConfig = getPaymentPlan(plan);
  if (!planConfig) {
    throw new AppError("Invalid plan selected.", 400, "INVALID_PLAN");
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError("Workspace not found.", 404);

  if (tenant.plan === plan) {
    throw new AppError("You are already on this plan.", 400, "ALREADY_ON_PLAN");
  }

  const razorpay = getRazorpayClient();
  const receipt = buildOrderReceipt(plan);

  let order;
  try {
    order = await razorpay.orders.create({
      amount: planConfig.amountPaise,
      currency: planConfig.currency,
      receipt,
      notes: {
        tenantId: tenantId.toString(),
        userId: userId.toString(),
        plan,
        organizationId: organizationId?.toString() || "",
      },
    });
  } catch (err) {
    throw toAppError(
      err,
      "Could not create payment order. Check Razorpay API keys.",
      502,
    );
  }

  await Payment.create({
    tenantId,
    organizationId: organizationId || tenant.organizationId,
    userId,
    plan,
    amount: planConfig.amountPaise,
    currency: planConfig.currency,
    razorpayOrderId: order.id,
    receipt,
    status: "created",
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
    plan,
    planLabel: planConfig.label,
  };
}

async function applyPlanUpgrade(tenantId, organizationId, plan) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new AppError("Workspace not found.", 404);

  tenant.plan = plan;
  await tenant.save();

  const orgId = organizationId || tenant.organizationId;
  if (orgId) {
    const org = await Organization.findById(orgId);
    if (org) {
      org.plan = plan;
      await org.save();
    }
  }

  return tenant;
}

export async function verifyPlanPayment({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new AppError("Payment provider is not configured.", 503, "PAYMENTS_DISABLED");
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expected !== razorpaySignature) {
    throw new AppError("Payment verification failed.", 400, "INVALID_SIGNATURE");
  }

  const payment = await Payment.findOne({ razorpayOrderId });
  if (!payment) throw new AppError("Payment order not found.", 404);

  if (payment.status === "paid") {
    return { plan: payment.plan, alreadyPaid: true };
  }

  payment.status = "paid";
  payment.razorpayPaymentId = razorpayPaymentId;
  await payment.save();

  await applyPlanUpgrade(payment.tenantId, payment.organizationId, payment.plan);

  return { plan: payment.plan, alreadyPaid: false };
}

export async function handleRazorpayWebhook(rawBody, signature) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new AppError("Webhook secret not configured.", 503);
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (expected !== signature) {
    throw new AppError("Invalid webhook signature.", 400, "INVALID_WEBHOOK");
  }

  const payload = JSON.parse(rawBody.toString("utf8"));
  const event = payload?.event;

  if (event === "payment.captured") {
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId || !paymentId) return { handled: false };

    const payment = await Payment.findOne({ razorpayOrderId: orderId });
    if (!payment || payment.status === "paid") return { handled: true };

    payment.status = "paid";
    payment.razorpayPaymentId = paymentId;
    await payment.save();

    await applyPlanUpgrade(payment.tenantId, payment.organizationId, payment.plan);
    return { handled: true };
  }

  return { handled: false, event };
}
