// Centralised error handler. Any route that calls next(err), or throws inside
export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message =
    status === 500 ? "Something went wrong on our end." : err.message || "Request failed.";
  res.status(status).json({ error: message });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
