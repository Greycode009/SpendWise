import { badRequest, formatZodError } from '../utils/errors.js';

/** Parse req[source] with a Zod schema; the parsed value replaces req.valid[source]. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source] ?? {});
  if (!result.success) {
    const { message, details } = formatZodError(result.error);
    return next(badRequest(message, details));
  }
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};
