import { createRequire } from 'node:module';

const { version } = createRequire(import.meta.url)('../../package.json');
export const PRODUCT = Object.freeze({ name: 'StockFlow', version });
