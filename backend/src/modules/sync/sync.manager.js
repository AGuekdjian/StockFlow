export class SyncManager {
  constructor({ outbox, coordinator, mongo, logger, intervalMs = 5000 }) {
    this.outbox = outbox;
    this.coordinator = coordinator;
    this.mongo = mongo;
    this.logger = logger;
    this.intervalMs = intervalMs;
    this.timer = null;
    this.running = false;
    this.stopped = true;
  }
  start() {
    if (!this.stopped) return;
    this.stopped = false;
    this.outbox.recoverAbandoned(new Date(Date.now() - 5 * 60_000));
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
        const operation = this.outbox.claimNext();
        if (operation) {
          this.logger.info({ event: 'sync.started', operationId: operation.operationId });
          await this.coordinator.process(operation);
        }
      }
    } finally {
      this.running = false;
      this.schedule();
    }
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    while (this.running) await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
