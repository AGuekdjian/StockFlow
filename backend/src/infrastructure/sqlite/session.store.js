import session from 'express-session';

export class SqliteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
  }
  get(id, callback) {
    try {
      const row = this.database
        .prepare('SELECT data, expires_at FROM sessions WHERE session_id = ?')
        .get(id);
      if (!row || row.expires_at <= Date.now()) {
        if (row) this.database.prepare('DELETE FROM sessions WHERE session_id = ?').run(id);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.data));
    } catch (error) {
      return callback(error);
    }
  }
  set(id, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;
      this.database
        .prepare(
          `INSERT INTO sessions(session_id,data,expires_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET data=excluded.data, expires_at=excluded.expires_at, updated_at=excluded.updated_at`,
        )
        .run(id, JSON.stringify(value), expiresAt, new Date().toISOString());
      callback();
    } catch (error) {
      callback(error);
    }
  }
  destroy(id, callback = () => {}) {
    try {
      this.database.prepare('DELETE FROM sessions WHERE session_id = ?').run(id);
      callback();
    } catch (error) {
      callback(error);
    }
  }
  touch(id, value, callback = () => {}) {
    this.set(id, value, callback);
  }
  clearExpired() {
    return this.database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
      .changes;
  }
  destroyUserSessions(userId) {
    const rows = this.database.prepare('SELECT session_id,data FROM sessions').all();
    const remove = this.database.prepare('DELETE FROM sessions WHERE session_id=?');
    return this.database.transaction(() =>
      rows.reduce((count, row) => {
        const value = JSON.parse(row.data);
        return value.user?.id === userId ? count + remove.run(row.session_id).changes : count;
      }, 0),
    )();
  }
}
