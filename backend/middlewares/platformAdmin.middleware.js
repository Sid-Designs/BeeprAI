import { AppError } from "../utils/AppError.js";

/**
 * Platform-level admin (cross-tenant). Separate from organization "owner" role.
 * Must be used after authenticate().
 */
export function requirePlatformAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401, "NO_TOKEN"));
  }

  if (!req.user.isPlatformAdmin) {
    return next(
      new AppError("Platform admin access required.", 403, "FORBIDDEN"),
    );
  }

  next();
}
