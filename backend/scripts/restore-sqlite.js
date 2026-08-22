import '../src/config/load-dotenv.js';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import Database from 'better-sqlite3';

const archivePath = process.argv[2];
const targetPath = process.env.SQLITE_PATH;
const backupRoot = process.env.BACKUP_PATH;
if (!archivePath || !targetPath || !backupRoot)
  throw new Error('Archivo, SQLITE_PATH y BACKUP_PATH son obligatorios.');

const archive = new Database(archivePath, { readonly: true, fileMustExist: true });
try {
  if (archive.pragma('integrity_check', { simple: true }) !== 'ok')
    throw new Error('El archivo SQLite no superó integrity_check.');
} finally {
  archive.close();
}
mkdirSync(backupRoot, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
if (existsSync(targetPath))
  copyFileSync(targetPath, join(backupRoot, `before_restore_${stamp}.sqlite`));
copyFileSync(archivePath, targetPath);
console.log(`SQLite restaurado desde ${basename(archivePath)}.`);
