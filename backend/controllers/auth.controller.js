import User from "../models/user.model.js";
import { hashPassword, comparePassword, generateRawToken, hashToken } from "../services/auth.service.js";
import { issueTokenPair, rotateRefreshToken, revokeRefreshToken, revokeAllRefreshTokens } from "../services/token.service.js";
import { createUser, findUserByEmailForAuth, findUserById } from "../services/user.service.js";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../services/email.service.js";
import { log } from "../services/auditLog.service.js";
import { sendResponse } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRY_MS =
  parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || "7", 10) * 24 * 60 * 60 * 1000;

const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000;    // 1 hour

// ─── Cookie helpers ──────────────────────────────────────────────────────────

function setRefreshCookie(res, rawToken) {
  res.cookie("refreshToken", rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: "/",
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", { httpOnly: true, path: "/" });
}

function safeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    organizationId: user.organizationId,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

// ─── Register ────────────────────────────────────────────────────────────────

export async function register(req, res) {
  const { fullName, email, phone, password } = req.body;

  const passwordHash = await hashPassword(password);
  const user = await createUser({ fullName, email, phone, passwordHash });

  const rawToken = generateRawToken(32);
  user.emailVerifyToken = hashToken(rawToken);
  user.emailVerifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);
  await user.save();

  sendVerificationEmail(email, fullName, rawToken).catch((err) =>
    console.error("[auth] Verification email failed:", err.message),
  );

  log({
    actorId: user._id,
    action: "auth.register",
    resourceType: "User",
    resourceId: user._id.toString(),
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    success: true,
  });

  sendResponse(res, 201, "Account created. Check your email to verify your address.", {
    user: safeUser(user),
  });
}

// ─── Verify Email ────────────────────────────────────────────────────────────

export async function verifyEmail(req, res) {
  const { token } = req.params;
  if (!token) throw new AppError("Verification token is required.", 400);

  const tokenHash = hashToken(token);

  const user = await User.findOne({ emailVerifyToken: tokenHash }).select(
    "+emailVerifyToken +emailVerifyExpires",
  );

  if (!user) {
    throw new AppError("Invalid or expired verification link.", 400, "INVALID_VERIFY_TOKEN");
  }

  if (user.emailVerifyExpires < new Date()) {
    throw new AppError(
      "This verification link has expired. Please request a new one.",
      400,
      "VERIFY_TOKEN_EXPIRED",
    );
  }

  user.isEmailVerified = true;
  user.emailVerifyToken = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();

  sendWelcomeEmail(user.email, user.fullName).catch(() => {});

  log({
    actorId: user._id,
    action: "auth.verifyEmail",
    resourceType: "User",
    resourceId: user._id.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Email verified successfully. You can now log in.");
}

// ─── Resend Verification ─────────────────────────────────────────────────────

export async function resendVerification(req, res) {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+emailVerifyToken +emailVerifyExpires",
  );

  // Always respond 200 to prevent email enumeration
  if (!user || user.isEmailVerified) {
    return sendResponse(
      res,
      200,
      "If your account exists and is unverified, a new email has been sent.",
    );
  }

  const rawToken = generateRawToken(32);
  user.emailVerifyToken = hashToken(rawToken);
  user.emailVerifyExpires = new Date(Date.now() + EMAIL_VERIFY_EXPIRY_MS);
  await user.save();

  sendVerificationEmail(user.email, user.fullName, rawToken).catch((err) =>
    console.error("[auth] Resend verification email failed:", err.message),
  );

  sendResponse(
    res,
    200,
    "If your account exists and is unverified, a new email has been sent.",
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await findUserByEmailForAuth(email);

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  if (!user.isActive) {
    throw new AppError("This account has been deactivated.", 403, "ACCOUNT_DEACTIVATED");
  }

  if (!user.isEmailVerified) {
    throw new AppError(
      "Please verify your email address before logging in.",
      403,
      "EMAIL_NOT_VERIFIED",
    );
  }

  const userAgent = req.headers["user-agent"] || "";
  const { accessToken, rawRefreshToken } = await issueTokenPair(user, userAgent);

  setRefreshCookie(res, rawRefreshToken);

  log({
    organizationId: user.organizationId,
    actorId: user._id,
    actorRole: user.role,
    action: "auth.login",
    resourceType: "User",
    resourceId: user._id.toString(),
    ipAddress: req.ip,
    userAgent,
    success: true,
  });

  sendResponse(res, 200, "Login successful.", {
    accessToken,
    user: safeUser(user),
  });
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

export async function refresh(req, res) {
  const rawToken = req.cookies?.refreshToken;
  if (!rawToken) throw new AppError("Refresh token not found.", 401, "NO_REFRESH_TOKEN");

  const tokenHash = hashToken(rawToken);

  const user = await User.findOne({
    "refreshTokens.tokenHash": tokenHash,
    isActive: true,
  }).select("+refreshTokens");

  if (!user) {
    throw new AppError("Invalid or expired refresh token.", 401, "INVALID_REFRESH_TOKEN");
  }

  const userAgent = req.headers["user-agent"] || "";
  const result = await rotateRefreshToken(user, rawToken, userAgent);

  if (!result) {
    clearRefreshCookie(res);
    throw new AppError(
      "Security alert: token reuse detected. All sessions have been revoked. Please log in again.",
      401,
      "TOKEN_REUSE_DETECTED",
    );
  }

  setRefreshCookie(res, result.rawRefreshToken);
  sendResponse(res, 200, "Token refreshed.", { accessToken: result.accessToken });
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logout(req, res) {
  const rawToken = req.cookies?.refreshToken;

  if (rawToken) {
    const user = await findUserById(req.user._id);
    if (user) await revokeRefreshToken(user, rawToken);
  }

  clearRefreshCookie(res);

  log({
    organizationId: req.user?.organizationId,
    actorId: req.user?._id,
    action: "auth.logout",
    resourceType: "User",
    resourceId: req.user?._id?.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Logged out successfully.");
}

// ─── Logout All ──────────────────────────────────────────────────────────────

export async function logoutAll(req, res) {
  const user = await findUserById(req.user._id);
  if (user) await revokeAllRefreshTokens(user);

  clearRefreshCookie(res);

  log({
    organizationId: req.user?.organizationId,
    actorId: req.user?._id,
    action: "auth.logoutAll",
    resourceType: "User",
    resourceId: req.user?._id?.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "All sessions have been revoked.");
}

// ─── Forgot Password ─────────────────────────────────────────────────────────

export async function forgotPassword(req, res) {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordResetToken +passwordResetExpires",
  );

  const genericMsg =
    "If an account with that email exists, a reset link has been sent.";

  if (user && user.isActive) {
    const rawToken = generateRawToken(32);
    user.passwordResetToken = hashToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
    await user.save();

    sendPasswordResetEmail(user.email, user.fullName, rawToken).catch((err) =>
      console.error("[auth] Password reset email failed:", err.message),
    );

    log({
      actorId: user._id,
      action: "auth.forgotPassword",
      resourceType: "User",
      resourceId: user._id.toString(),
      ipAddress: req.ip,
      success: true,
    });
  }

  sendResponse(res, 200, genericMsg);
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;

  if (!token) throw new AppError("Reset token is required.", 400);

  const tokenHash = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires +refreshTokens");

  if (!user) {
    throw new AppError(
      "Invalid or expired password reset link.",
      400,
      "INVALID_RESET_TOKEN",
    );
  }

  user.passwordHash = await hashPassword(password);
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.refreshTokens = [];
  await user.save();

  log({
    actorId: user._id,
    action: "auth.resetPassword",
    resourceType: "User",
    resourceId: user._id.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Password reset successfully. Please log in with your new password.");
}

// ─── Me ───────────────────────────────────────────────────────────────────────

export async function me(req, res) {
  sendResponse(res, 200, "User profile.", { user: safeUser(req.user) });
}
