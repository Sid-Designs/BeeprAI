import express from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  refreshLimiter,
  resendVerificationLimiter,
} from "../middlewares/rateLimiter.middleware.js";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from "../validations/auth.validation.js";

const router = express.Router();

router.post("/register", registerLimiter, validate(registerSchema), authController.register);
router.get("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", resendVerificationLimiter, validate(resendVerificationSchema), authController.resendVerification);

router.post("/login", loginLimiter, validate(loginSchema), authController.login);
router.post("/refresh", refreshLimiter, authController.refresh);

router.post("/logout", authenticate({ requireEmailVerified: false }), authController.logout);
router.post("/logout-all", authenticate({ requireEmailVerified: false }), authController.logoutAll);

router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password/:token", validate(resetPasswordSchema), authController.resetPassword);

router.get("/me", authenticate({ requireEmailVerified: false }), authController.me);

export default router;
