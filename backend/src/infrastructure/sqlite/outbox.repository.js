const statuses = new Set(['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT']);
const transitions = {
  PENDING: new Set(['SYNCING']),
  SYNCING: new Set(['SYNCED', 'PENDING', 'FAILED', 'CONFLICT']),
  FAILED: new Set(['PENDING']),
  CONFLICT: new Set([]),
  SYNCED: new Set([]),
};

export class OutboxRepository {
  constructor(database) {
    this.database = database;
  }
  enqueue(operationId, type, payload) {
    const now = new Date().toISOString();
    this.database
      .prepare(
        `INSERT INTO outbox_operations(operation_id,type,payload,status,created_at,updated_at) VALUES(?,?,?,'PENDING',?,?) ON CONFLICT(operation_id) DO NOTHING`,
      )
      .run(operationId, type, JSON.stringify(payload), now, now);
    return this.get(operationId);
  }
  get(operationId) {
    const row = this.database
      .prepare('SELECT * FROM outbox_operations WHERE operation_id=?')
      .get(operationId);
    return row ? this.map(row) : null;
  }
  map(row) {
    return {
      operationId: row.operation_id,
      type: row.type,
      payload: JSON.parse(row.payload),
      status: row.status,
      attempts: row.attempts,
      nextAttemptAt: row.next_attempt_at,
      lockedAt: row.locked_at,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  claimNext(now = new Date()) {
    return this.database.transaction(() => {
      const row = this.database
        .prepare(
          `SELECT operation_id FROM outbox_operations WHERE status='PENDING' AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at LIMIT 1`,
        )
        .get(now.toISOString());
      if (!row) return null;
      const result = this.database
        .prepare(
          `UPDATE outbox_operations SET status='SYNCING', attempts=attempts+1, locked_at=?, updated_at=? WHERE operation_id=? AND status='PENDING'`,
        )
        .run(now.toISOString(), now.toISOString(), row.operation_id);
      return result.changes === 1 ? this.get(row.operation_id) : null;
    })();
  }
  claim(operationId, now = new Date()) {
    const result = this.database
      .prepare(
        `UPDATE outbox_operations SET status='SYNCING', attempts=attempts+1, locked_at=?, updated_at=? WHERE operation_id=? AND status='PENDING'`,
      )
      .run(now.toISOString(), now.toISOString(), operationId);
    return result.changes === 1 ? this.get(operationId) : null;
  }
  transition(operationId, target, { error, nextAttemptAt } = {}) {
    if (!statuses.has(target)) throw new Error(`Unknown outbox status: ${target}`);
    const current = this.get(operationId);
    if (!current || !transitions[current.status].has(target))
      throw new Error(`Invalid outbox transition: ${current?.status ?? 'MISSING'} -> ${target}`);
    this.database
      .prepare(
        'UPDATE outbox_operations SET status=?, last_error=?, next_attempt_at=?, locked_at=NULL, updated_at=? WHERE operation_id=?',
      )
      .run(
        target,
        error ?? null,
        nextAttemptAt?.toISOString() ?? null,
        new Date().toISOString(),
        operationId,
      );
    return this.get(operationId);
  }
  recoverAbandoned(before) {
    return this.database
      .prepare(
        `UPDATE outbox_operations SET status='PENDING', locked_at=NULL, next_attempt_at=NULL, updated_at=? WHERE status='SYNCING' AND locked_at<?`,
      )
      .run(new Date().toISOString(), before.toISOString()).changes;
  }
  pruneSynced(before) {
    return this.database
      .prepare("DELETE FROM outbox_operations WHERE status='SYNCED' AND updated_at<?")
      .run(before.toISOString()).changes;
  }
  retryFailed(operationId) {
    return this.transition(operationId, 'PENDING');
  }
  list({ status, page, limit }) {
    const where = status ? 'WHERE o.status=?' : '';
    const args = status ? [status] : [];
    const rows = this.database
      .prepare(
        `SELECT o.*, r.action AS resolution_action, r.resolution_operation_id, r.reason AS resolution_reason, r.resolved_by, r.resolved_at FROM outbox_operations o LEFT JOIN outbox_resolutions r ON r.conflict_operation_id=o.operation_id ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...args, limit, (page - 1) * limit);
    const total = this.database
      .prepare(`SELECT COUNT(*) AS count FROM outbox_operations o ${where}`)
      .get(...args).count;
    return [
      rows.map((row) => ({
        ...this.map(row),
        resolution: row.resolution_action
          ? {
              action: row.resolution_action,
              operationId: row.resolution_operation_id,
              reason: row.resolution_reason,
              resolvedBy: row.resolved_by,
              resolvedAt: row.resolved_at,
            }
          : null,
      })),
      total,
    ];
  }
  resolveConflict(conflictOperationId, { action, resolutionOperationId, reason, resolvedBy }) {
    const conflict = this.get(conflictOperationId);
    if (conflict?.status !== 'CONFLICT') throw new Error('Operation is not a conflict');
    this.database
      .prepare(
        'INSERT INTO outbox_resolutions(conflict_operation_id,resolution_operation_id,action,reason,resolved_by,resolved_at) VALUES(?,?,?,?,?,?)',
      )
      .run(
        conflictOperationId,
        resolutionOperationId ?? null,
        action,
        reason,
        resolvedBy,
        new Date().toISOString(),
      );
  }
}
