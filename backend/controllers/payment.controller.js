import {
  createPlanOrder,
  getPaymentConfig,
  handleRazorpayWebhook,
  verifyPlanPayment,
} from "../services/payment.service.js";
import { sendResponse } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";
import { assertTenantAccess } from "../services/tenantAccess.service.js";

export async function getConfig(req, res) {
  sendResponse(res, 200, "Payment configuration.", getPaymentConfig());
}

export async function createOrder(req, res) {
  const { tenantId, plan } = req.body;

  if (!tenantId || !plan) {
    throw new AppError("tenantId and plan are required.", 400);
  }

  if (!["pro", "enterprise"].includes(plan)) {
    throw new AppError("Invalid plan.", 400, "INVALID_PLAN");
  }

  await assertTenantAccess(req.user, tenantId);

  const order = await createPlanOrder({
    tenantId,
    userId: req.user._id,
    organizationId: req.user.organizationId,
    plan,
  });

  sendResponse(res, 200, "Order created.", order);
}

export async function verifyPayment(req, res) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError("Payment verification fields are required.", 400);
  }

  const result = await verifyPlanPayment({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });

  sendResponse(res, 200, "Payment verified. Plan upgraded.", result);
}

export async function webhook(req, res) {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    throw new AppError("Missing webhook signature.", 400);
  }

  const rawBody = req.body;
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    throw new AppError("Invalid webhook payload.", 400);
  }

  await handleRazorpayWebhook(rawBody, signature);
  res.status(200).json({ success: true });
}
