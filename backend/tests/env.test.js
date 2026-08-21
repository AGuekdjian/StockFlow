import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const valid = {
  NODE_ENV: 'test',
  PORT: '3000',
  FRONTEND_ORIGIN: 'http://localhost:5173',
  MONGODB_URI: 'mongodb://localhost/test',
  SESSION_SECRET: '12345678901234567890123456789012',
  SQLITE_PATH: './data/test.sqlite',
  LOG_PATH: './logs',
  BACKUP_PATH: './backups',
};
describe('environment validation', () => {
  it('fails fast and names missing critical configuration', () => {
    const source = { ...valid };
    delete source.SESSION_SECRET;
    expect(() => loadEnv(source)).toThrow('SESSION_SECRET');
  });
  it('coerces bounded operational settings', () => {
    expect(
      loadEnv({ ...valid, COOKIE_SECURE: 'true', SESSION_HOURS: '12', SYNC_INTERVAL_MS: '2000' }),
    ).toMatchObject({ COOKIE_SECURE: true, SESSION_HOURS: 12, SYNC_INTERVAL_MS: 2000 });
  });
});
