import '../src/config/load-dotenv.js';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const sourcePath = process.env.SQLITE_PATH;
const backupRoot = process.env.BACKUP_PATH;
if (!sourcePath || !backupRoot) throw new Error('SQLITE_PATH y BACKUP_PATH son obligatorios.');

mkdirSync(backupRoot, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
const destination = join(backupRoot, `sqlite_${stamp}.sqlite`);
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
try {
  await source.backup(destination);
} finally {
  source.close();
}
const verification = new Database(destination, { readonly: true, fileMustExist: true });
try {
  if (verification.pragma('integrity_check', { simple: true }) !== 'ok')
    throw new Error('La copia SQLite no superó integrity_check.');
} finally {
  verification.close();
}
console.log(destination);
