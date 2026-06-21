import { AppError } from "../utils/AppError.js";

/**
 * internalAuth
 *
 * Protects endpoints that are only meant to be called by internal backend
 * services (e.g. worker launcher, post-call analysis pipeline).
 *
 * Checks for X-Internal-Token header matching INTERNAL_SERVICE_TOKEN env var.
 */
export function internalAuth(req, res, next) {
  const token = req.headers["x-internal-token"];

  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    // If not configured, skip protection in development only
    if (process.env.NODE_ENV !== "production") return next();
    return next(new AppError("Internal service token not configured.", 500));
  }

  if (!token || token !== process.env.INTERNAL_SERVICE_TOKEN) {
    return next(new AppError("Unauthorized internal request.", 401, "INVALID_INTERNAL_TOKEN"));
  }

  next();
}
