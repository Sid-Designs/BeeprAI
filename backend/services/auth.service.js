import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "node:crypto";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function generateAccessToken(payload) {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
}

export function generateRawToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(rawToken) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildTokenPayload(user) {
  return {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
    orgId: user.organizationId ? user.organizationId.toString() : null,
  };
}
