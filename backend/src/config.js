/**
 * Centralised configuration. Every secret comes from environment variables
 * (see .env.example) — nothing sensitive is hard-coded.
 */
const env = process.env;

const isProduction = env.NODE_ENV === 'production';
const isTest = env.NODE_ENV === 'test';

const DEV_SECRET = 'dev-only-insecure-secret-change-me';

export const config = {
  env: env.NODE_ENV || 'development',
  isProduction,
  isTest,
  port: Number(env.PORT || 4000),
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET || DEV_SECRET,
  accessTokenTtl: env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(env.REFRESH_TOKEN_DAYS || 30),
  bcryptRounds: Number(env.BCRYPT_ROUNDS || (isTest ? 4 : 12)),
  // Comma-separated list of allowed browser origins when the frontend is
  // hosted on a different domain than the API. Empty = same-origin only.
  corsOrigins: (env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Set to the number of proxies in front of the app (e.g. 1 on Render/Railway)
  // so rate limiting sees the real client IP.
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : 0,
  // Serve the built frontend (frontend/dist) from the API server.
  serveClient: env.SERVE_CLIENT !== 'false',
  clientDist: env.CLIENT_DIST,
  authRateLimit: Number(env.AUTH_RATE_LIMIT || (isTest ? 1000 : 20)),
  apiRateLimit: Number(env.API_RATE_LIMIT || (isTest ? 100000 : 600)),
};

export function assertProductionConfig() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  }
  if (isProduction && (config.jwtSecret === DEV_SECRET || config.jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters in production.');
  }
}
