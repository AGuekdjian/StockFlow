import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const projectEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(projectEnv)) process.loadEnvFile(projectEnv);
