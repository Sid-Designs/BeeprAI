import { AppError } from "../utils/AppError.js";

/**
 * requireOrganization
 *
 * Ensures the authenticated user belongs to an organization.
 * Must be used after authenticate().
 *
 * Attaches req.organizationId from the JWT (never from the request body).
 */
export function requireOrganization(req, res, next) {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401, "NO_TOKEN"));
  }

  if (!req.user.organizationId) {
    return next(
      new AppError(
        "You must create or join an organization first.",
        403,
        "NO_ORGANIZATION",
      ),
    );
  }

  req.organizationId = req.user.organizationId;
  next();
}
