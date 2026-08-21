import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_ORIGIN: z.string().url(),
  MONGODB_URI: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SQLITE_PATH: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_PATH: z.string().min(1),
  BACKUP_PATH: z.string().min(1),
  MONGODB_CONNECT_ON_START: booleanString.default('true'),
  COOKIE_SECURE: booleanString.default('false'),
  SESSION_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  SYNC_INTERVAL_MS: z.coerce.number().int().min(1000).max(300000).default(5000),
});

export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuración inválida o incompleta: ${fields}`);
  }
  return result.data;
}
