import { resolveErrorMessage, resolveErrorStatus } from "../utils/errorMessage.js";

const errorMiddleware = (err, req, res, next) => {
  const status = resolveErrorStatus(err, 500);
  const message = resolveErrorMessage(err, "Internal Server Error");

  if (status >= 500) {
    console.error("[error]", message, err?.stack || err);
  } else {
    console.warn("[error]", message);
  }

  res.status(status).json({
    success: false,
    message,
    ...(err?.code ? { code: err.code } : err?.error?.code ? { code: err.error.code } : {}),
  });
};

export default errorMiddleware;
