import { verifyAccessToken } from '../services/auth.service.js';
import { unauthorized } from '../utils/errors.js';

/** Require a valid "Authorization: Bearer <accessToken>" header; sets req.userId. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(unauthorized());
  try {
    req.userId = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
