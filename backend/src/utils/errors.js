/** An error with an HTTP status and a machine-readable code, safe to show to clients. */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);
export const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message, code = 'CONFLICT') => new AppError(409, code, message);

/** Turn a Zod error into a readable message + field list. */
export function formatZodError(error) {
  const details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  const first = details[0];
  const message = first ? `${first.path ? `${first.path}: ` : ''}${first.message}` : 'Invalid input';
  return { message, details };
}
