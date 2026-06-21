import rateLimit from "express-rate-limit";

function limiter(windowMinutes, max, message) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    skipSuccessfulRequests: false,
  });
}

export const loginLimiter = limiter(
  15,
  10,
  "Too many login attempts. Please try again in 15 minutes.",
);

export const registerLimiter = limiter(
  60,
  5,
  "Too many registration attempts. Please try again later.",
);

export const forgotPasswordLimiter = limiter(
  60,
  3,
  "Too many password reset requests. Please try again in 1 hour.",
);

export const refreshLimiter = limiter(
  15,
  20,
  "Too many token refresh requests.",
);

export const resendVerificationLimiter = limiter(
  60,
  3,
  "Too many verification email requests. Please try again in 1 hour.",
);

export const globalLimiter = limiter(
  1,
  200,
  "Too many requests from this IP. Please slow down.",
);
