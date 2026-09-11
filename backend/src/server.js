import { createApp } from './app.js';
import { assertProductionConfig, config } from './config.js';
import { prisma } from './lib/prisma.js';
import { pruneRefreshTokens } from './services/auth.service.js';
import { pruneSyncLog } from './services/sync.service.js';

assertProductionConfig();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`SpendWise API listening on http://localhost:${config.port} (${config.env})`);
});

// Housekeeping once a day: drop expired refresh tokens and old sync op ids.
async function housekeeping() {
  try {
    const [tokens, ops] = await Promise.all([pruneRefreshTokens(), pruneSyncLog()]);
    if (tokens || ops) console.log(`[housekeeping] removed ${tokens} tokens, ${ops} sync log entries`);
  } catch (err) {
    console.error('[housekeeping] failed', err.message);
  }
}
setTimeout(housekeeping, 10_000).unref();
setInterval(housekeeping, 24 * 60 * 60 * 1000).unref();

async function shutdown(signal) {
  console.log(`${signal} received, shutting down…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
