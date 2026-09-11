import { rateLimit } from 'express-rate-limit';
import { config } from '../config.js';

const handler = (_req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } });

/** Strict limit for login/register/refresh to slow down password guessing. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

/** General API limit per client. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.apiRateLimit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});
