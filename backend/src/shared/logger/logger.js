import { mkdirSync } from 'node:fs';
import pino from 'pino';
import { createStream } from 'rotating-file-stream';

const redact = [
  'password',
  'passwordHash',
  'req.headers.cookie',
  'sessionSecret',
  'token',
  'mongodbUri',
];

export function createLogger({ level = 'info', path, environment = 'development' }) {
  if (environment === 'test') return pino({ level: 'silent' });
  mkdirSync(path, { recursive: true });
  const destination = createStream('application.log', {
    path,
    size: '10M',
    interval: '1d',
    maxFiles: 14,
    compress: 'gzip',
  });
  return pino(
    {
      level,
      redact,
      base: { service: 'stock-control-backend' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );
}
