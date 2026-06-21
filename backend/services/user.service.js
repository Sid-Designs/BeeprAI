import User from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";

export async function createUser({ fullName, email, phone, passwordHash, role = "viewer" }) {
  const existing = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { phone }],
  });

  if (existing) {
    if (existing.email === email.toLowerCase()) {
      throw new AppError("An account with this email already exists.", 409, "EMAIL_TAKEN");
    }
    throw new AppError("An account with this phone number already exists.", 409, "PHONE_TAKEN");
  }

  const user = await User.create({ fullName, email, phone, passwordHash, role });
  return user;
}

export async function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase(), isActive: true }).select(
    "+passwordHash +refreshTokens",
  );
}

export async function findUserByEmailForAuth(email) {
  return User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash +emailVerifyToken +emailVerifyExpires +passwordResetToken +passwordResetExpires +refreshTokens",
  );
}

export async function findUserById(id) {
  return User.findById(id).select("+refreshTokens");
}

export async function findUserByIdBasic(id) {
  return User.findById(id);
}

export async function updateUser(id, updates) {
  return User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
}
