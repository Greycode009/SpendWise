import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load backend/.env.test before any app module reads process.env.
const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env.test');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
process.env.NODE_ENV = 'test';
