import { AppError } from "../utils/AppError.js";

const ROLE_HIERARCHY = {
  owner: 4,
  admin: 3,
  agentManager: 2,
  viewer: 1,
};

/**
 * authorize(...roles)
 *
 * Checks that req.user.role is one of the allowed roles.
 * Must be used after authenticate().
 *
 * Usage:
 *   router.post('/create', authenticate(), authorize('owner', 'admin', 'agentManager'), handler)
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required.", 401, "NO_TOKEN"));
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? 0;
    const allowed = allowedRoles.some(
      (role) => ROLE_HIERARCHY[role] !== undefined && userLevel >= ROLE_HIERARCHY[role],
    );

    if (!allowed) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(" or ")}.`,
          403,
          "FORBIDDEN",
        ),
      );
    }

    next();
  };
}
