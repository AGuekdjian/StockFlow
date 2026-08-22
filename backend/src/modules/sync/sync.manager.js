export class SyncManager {
  constructor({
    outbox,
    coordinator,
    mongo,
    logger,
    sessionStore,
    intervalMs = 5000,
    batchSize = 25,
    syncedRetentionDays = 90,
  }) {
    this.outbox = outbox;
    this.coordinator = coordinator;
    this.mongo = mongo;
    this.logger = logger;
    this.intervalMs = intervalMs;
    this.batchSize = batchSize;
    this.sessionStore = sessionStore;
    this.syncedRetentionDays = syncedRetentionDays;
    this.lastMaintenanceAt = 0;
    this.timer = null;
    this.running = false;
    this.stopped = true;
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.outbox.recoverAbandoned(new Date(Date.now() - 5 * 60_000));
    this.maintain();
    this.schedule(0);
  }
  schedule(delay = this.intervalMs) {
    if (!this.stopped) this.timer = setTimeout(() => this.tick(), delay).unref();
  }
  async tick() {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      if (!this.mongo.available && this.mongo.connect) await this.mongo.connect();
      if (this.mongo.available) {
        let processed = 0;
        let operation;
        while (
          !this.stopped &&
          processed < this.batchSize &&
          (operation = this.outbox.claimNext())
        ) {
          this.logger.info({ event: 'sync.started', operationId: operation.operationId });
          await this.coordinator.process(operation);
          processed += 1;
        }
      }
      this.maintain();
    } finally {
      this.running = false;
      this.schedule();
    }
  }
  maintain(now = new Date()) {
    if (now.getTime() - this.lastMaintenanceAt < 60 * 60_000) return;
    this.lastMaintenanceAt = now.getTime();
    const expiredSessions = this.sessionStore?.clearExpired() ?? 0;
    const retentionLimit = new Date(now.getTime() - this.syncedRetentionDays * 24 * 60 * 60_000);
    const prunedOperations = this.outbox.pruneSynced?.(retentionLimit) ?? 0;
    if (expiredSessions || prunedOperations)
      this.logger.info({ event: 'maintenance.completed', expiredSessions, prunedOperations });
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
