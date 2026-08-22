import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';

export function openSqlite(path) {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.exec(`CREATE TABLE IF NOT EXISTS outbox_operations (
    operation_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING','SYNCING','SYNCED','FAILED','CONFLICT')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    locked_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS idx_outbox_status_next_attempt ON outbox_operations(status, next_attempt_at);
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  ); CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS outbox_resolutions (
    conflict_operation_id TEXT PRIMARY KEY REFERENCES outbox_operations(operation_id),
    resolution_operation_id TEXT,
    action TEXT NOT NULL CHECK(action IN ('REPLACED','DISMISSED')),
    reason TEXT NOT NULL,
    resolved_by TEXT NOT NULL,
    resolved_at TEXT NOT NULL
  );`);
  const sessionColumns = database.pragma('table_info(sessions)');
  if (!sessionColumns.some((column) => column.name === 'user_id')) {
    database.exec('ALTER TABLE sessions ADD COLUMN user_id TEXT');
    const update = database.prepare('UPDATE sessions SET user_id=? WHERE session_id=?');
    database.transaction(() => {
      for (const row of database.prepare('SELECT session_id,data FROM sessions').all()) {
        const userId = JSON.parse(row.data)?.user?.id;
        if (userId) update.run(userId, row.session_id);
      }
    })();
  }
  database.exec('CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)');
  return database;
}

export function outboxCounts(database) {
  const rows = database
    .prepare('SELECT status, COUNT(*) AS count FROM outbox_operations GROUP BY status')
    .all();
  const result = { pending: 0, syncing: 0, failed: 0, conflicts: 0 };
  for (const row of rows) {
    const key = row.status === 'CONFLICT' ? 'conflicts' : row.status.toLowerCase();
    if (key in result) result[key] = row.count;
  }
  return result;
}

export function outboxMetrics(database) {
  const counts = outboxCounts(database);
  const oldest = database
    .prepare(
      "SELECT created_at FROM outbox_operations WHERE status IN ('PENDING','SYNCING','FAILED','CONFLICT') ORDER BY created_at LIMIT 1",
    )
    .get();
  return { ...counts, oldestUnresolvedAt: oldest?.created_at ?? null };
}
