import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Apply all migrations to the TEST database once before the suite.
 * Non-destructive: every test registers its own unique user, so leftover rows
 * from earlier runs never interfere. Drop/recreate the test database yourself
 * if you ever want a clean slate.
 */
export default function setup() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const envFile = path.join(root, '.env.test');
  if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
  if (!process.env.DATABASE_URL) throw new Error('Create backend/.env.test with a DATABASE_URL for a throwaway test database');
  if (!/test/i.test(process.env.DATABASE_URL)) {
    throw new Error('Refusing to run tests against a database whose URL does not contain "test"');
  }
  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  });
}
