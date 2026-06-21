import express from "express";
import * as paymentController from "../controllers/payment.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { z } from "zod";

const router = express.Router();

const createOrderSchema = z.object({
  tenantId: z.string().min(1),
  plan: z.enum(["pro", "enterprise"]),
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

router.get("/config", authenticate(), paymentController.getConfig);

router.post(
  "/create-order",
  authenticate(),
  authorize("owner", "admin"),
  validate(createOrderSchema),
  paymentController.createOrder,
);

router.post(
  "/verify",
  authenticate(),
  authorize("owner", "admin"),
  validate(verifyPaymentSchema),
  paymentController.verifyPayment,
);

export default router;
