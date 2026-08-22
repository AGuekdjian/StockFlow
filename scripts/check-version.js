import { readFileSync } from 'node:fs';

const files = [
  'package.json',
  'frontend/package.json',
  'backend/package.json',
  'shared/package.json',
];
const versions = files.map((file) => ({
  file,
  version: JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).version,
}));
const expected = versions[0].version;
const invalid = versions.filter(({ version }) => version !== expected);
if (invalid.length)
  throw new Error(
    `Versiones inconsistentes: ${versions.map(({ file, version }) => `${file}=${version}`).join(', ')}`,
  );
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected))
  throw new Error(`La versión ${expected} no cumple Semantic Versioning.`);
console.log(`StockFlow ${expected}: versiones consistentes.`);
