import { verifyAccessToken } from "../services/auth.service.js";
import { findUserById } from "../services/user.service.js";
import { AppError } from "../utils/AppError.js";

/**
 * authenticate({ requireEmailVerified: true })
 *
 * Extracts the JWT from Bearer header or `accessToken` cookie.
 * Attaches req.user and req.organizationId.
 *
 * Pass requireEmailVerified: false for routes that don't need a verified email
 * (e.g. /auth/me, /auth/logout, /auth/resend-verification).
 */
export function authenticate({ requireEmailVerified = true } = {}) {
  return async (req, res, next) => {
    try {
      let token = null;

      const authHeader = req.headers["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
      }

      if (!token) {
        throw new AppError("Authentication required.", 401, "NO_TOKEN");
      }

      let decoded;
      try {
        decoded = verifyAccessToken(token);
      } catch (err) {
        if (err.name === "TokenExpiredError") {
          throw new AppError("Access token expired.", 401, "TOKEN_EXPIRED");
        }
        throw new AppError("Invalid access token.", 401, "INVALID_TOKEN");
      }

      const user = await findUserById(decoded.sub);

      if (!user || !user.isActive) {
        throw new AppError("Account not found or deactivated.", 401, "USER_INACTIVE");
      }

      if (requireEmailVerified && !user.isEmailVerified) {
        throw new AppError(
          "Please verify your email address before continuing.",
          403,
          "EMAIL_NOT_VERIFIED",
        );
      }

      req.user = user;
      req.organizationId = user.organizationId ?? null;

      next();
    } catch (err) {
      next(err);
    }
  };
}
