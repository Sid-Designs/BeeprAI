import { AppError } from "./AppError.js";

/**
 * Normalize thrown values (Razorpay throws plain objects, not Error instances).
 */
export function resolveErrorMessage(err, fallback = "Internal Server Error") {
  if (!err) return fallback;
  if (typeof err === "string" && err.trim()) return err;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  if (typeof err.error?.description === "string" && err.error.description.trim()) {
    return err.error.description;
  }
  if (typeof err.error?.reason === "string" && err.error.reason.trim()) {
    return err.error.reason;
  }
  if (typeof err.description === "string" && err.description.trim()) {
    return err.description;
  }
  return fallback;
}

export function resolveErrorStatus(err, fallback = 500) {
  if (typeof err?.status === "number") return err.status;
  if (typeof err?.statusCode === "number") return err.statusCode;
  return fallback;
}

export function toAppError(err, fallbackMessage = "Request failed.", fallbackStatus = 500) {
  if (err instanceof AppError) return err;

  const message = resolveErrorMessage(err, fallbackMessage);
  const status = resolveErrorStatus(err, fallbackStatus);
  const code =
    typeof err?.code === "string"
      ? err.code
      : typeof err?.error?.code === "string"
        ? err.error.code
        : null;

  return new AppError(message, status, code);
}
