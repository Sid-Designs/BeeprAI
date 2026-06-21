export class AppError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.isOperational = true;
  }
}

export const createError = (message, status, code) =>
  new AppError(message, status, code);
