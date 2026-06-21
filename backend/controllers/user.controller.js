import { hashPassword, comparePassword } from "../services/auth.service.js";
import { updateUser } from "../services/user.service.js";
import { revokeAllRefreshTokens } from "../services/token.service.js";
import { findUserById } from "../services/user.service.js";
import { log } from "../services/auditLog.service.js";
import { sendResponse } from "../utils/response.utils.js";
import { AppError } from "../utils/AppError.js";
import User from "../models/user.model.js";

function safeUser(user) {
  return {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    organizationId: user.organizationId,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(req, res) {
  sendResponse(res, 200, "User profile.", { user: safeUser(req.user) });
}

export async function updateProfile(req, res) {
  const { fullName, phone } = req.body;
  const updates = {};

  if (fullName) updates.fullName = fullName;
  if (phone) {
    const taken = await User.findOne({ phone, _id: { $ne: req.user._id } });
    if (taken) throw new AppError("Phone number already in use.", 409, "PHONE_TAKEN");
    updates.phone = phone;
  }

  const updated = await updateUser(req.user._id, updates);

  log({
    organizationId: req.user.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "user.updateProfile",
    resourceType: "User",
    resourceId: req.user._id.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Profile updated.", { user: safeUser(updated) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+passwordHash +refreshTokens");
  if (!user) throw new AppError("User not found.", 404);

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw new AppError("Current password is incorrect.", 401, "WRONG_PASSWORD");

  user.passwordHash = await hashPassword(newPassword);
  // Revoke all sessions so attacker with old refresh tokens is booted
  user.refreshTokens = [];
  await user.save();

  res.clearCookie("refreshToken", { httpOnly: true, path: "/" });

  log({
    organizationId: req.user.organizationId,
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "user.changePassword",
    resourceType: "User",
    resourceId: req.user._id.toString(),
    ipAddress: req.ip,
    success: true,
  });

  sendResponse(res, 200, "Password changed. Please log in again.");
}
