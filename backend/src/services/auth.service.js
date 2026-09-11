/**
 * Authentication: bcrypt password hashing, short-lived JWT access tokens and
 * long-lived, rotating, revocable refresh tokens.
 *
 * Why two tokens? The PWA may stay offline for days. The access token
 * expires quickly (15 min) to limit damage if it leaks; when the app comes
 * back online it silently exchanges its refresh token for a new pair.
 * Refresh tokens are stored only as SHA-256 hashes and are single-use.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DEFAULT_CATEGORIES } from '@spendwise/shared';
import { prisma } from '../lib/prisma.js';
import { config } from '../config.js';
import { conflict, unauthorized } from '../utils/errors.js';
import { serializeUser } from '../utils/serialize.js';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.accessTokenTtl, algorithm: 'HS256' });
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    return payload.sub;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Access token expired', 'TOKEN_EXPIRED');
    throw unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
}

async function issueTokens(userId, userAgent, db = prisma) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await db.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken };
}

export async function register({ name, email, password, currency }, userAgent) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name, email, passwordHash, currency: currency || 'NPR' } });
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        userId: created.id,
        isDefault: true,
        clientUpdatedAt: now,
      })),
    });
    return created;
  });

  const tokens = await issueTokens(user.id, userAgent);
  return { user: serializeUser(user), ...tokens };
}

export async function login({ email, password }, userAgent) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');
  const tokens = await issueTokens(user.id, userAgent);
  return { user: serializeUser(user), ...tokens };
}

/** Exchange a refresh token for a new token pair (rotation: the old one is revoked). */
export async function refresh(refreshToken, userAgent) {
  const tokenHash = sha256(refreshToken);
  return prisma.$transaction(async (tx) => {
    const row = await tx.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw unauthorized('Session expired, please log in again', 'SESSION_EXPIRED');
    }
    // Conditional update = only one concurrent refresh with the same token can win.
    const { count } = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count !== 1) throw unauthorized('Session expired, please log in again', 'SESSION_EXPIRED');
    const tokens = await issueTokens(row.userId, userAgent, tx);
    return { user: serializeUser(row.user), ...tokens };
  });
}

export async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw unauthorized('Account no longer exists', 'INVALID_TOKEN');
  return serializeUser(user);
}

export async function updateProfile(userId, changes) {
  const user = await prisma.user.update({ where: { id: userId }, data: changes });
  return serializeUser(user);
}

/** Remove expired / long-revoked refresh tokens. */
export async function pruneRefreshTokens() {
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }],
    },
  });
  return count;
}
