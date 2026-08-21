import { AppError } from '../../shared/errors/app-error.js';

const conflictCodes = new Set([
  'INSUFFICIENT_STOCK',
  'STOCK_CHANGED',
  'PRODUCT_NOT_FOUND',
  'PRODUCT_INACTIVE',
  'PRODUCT_NOT_SERIALIZABLE',
  'RELATED_MOVEMENT_NOT_FOUND',
  'USER_INACTIVE',
  'FORBIDDEN',
]);
const delayFor = (attempt) => Math.min(5 * 60_000, 1000 * 2 ** Math.min(attempt - 1, 8));

export class StockOperationCoordinator {
  constructor({ outbox, inventoryService, mongo, logger }) {
    this.outbox = outbox;
    this.inventoryService = inventoryService;
    this.mongo = mongo;
    this.logger = logger;
  }
  async submit(input, context) {
    this.inventoryService.assertPermission?.(input, context);
    const existing = this.outbox.enqueue(input.operationId, input.type, {
      input,
      actor: { userId: context.userId, role: context.role },
      acceptedAt: new Date().toISOString(),
    });
    if (existing.status === 'SYNCED')
      return {
        status: 'SYNCED',
        movement: await this.inventoryService.inventory.findByOperationId(input.operationId),
      };
    if (existing.status === 'CONFLICT')
      throw new AppError({
        code: 'SYNC_CONFLICT',
        message: 'La operación tiene un conflicto pendiente de resolución.',
        status: 409,
      });
    if (!this.mongo.available || existing.status !== 'PENDING')
      return { status: existing.status, operationId: input.operationId };
    const claimed = this.outbox.claim(input.operationId);
    if (!claimed)
      return { status: this.outbox.get(input.operationId).status, operationId: input.operationId };
    return this.process(claimed, context.requestId);
  }
  async process(operation, requestId = `sync_${operation.operationId}`) {
    try {
      const movement = await this.inventoryService.execute(operation.payload.input, {
        ...operation.payload.actor,
        requestId,
      });
      this.outbox.transition(operation.operationId, 'SYNCED');
      this.logger.info({ event: 'sync.success', operationId: operation.operationId });
      return { status: 'SYNCED', movement };
    } catch (error) {
      if (conflictCodes.has(error.code)) {
        this.outbox.transition(operation.operationId, 'CONFLICT', {
          error: JSON.stringify({
            code: error.code,
            message: error.message,
            details: error.details,
          }),
        });
        this.logger.warn({
          event: 'sync.conflict',
          operationId: operation.operationId,
          code: error.code,
        });
        return {
          status: 'CONFLICT',
          operationId: operation.operationId,
          error: { code: error.code, message: error.message, details: error.details },
        };
      }
      const current = this.outbox.get(operation.operationId);
      const failed = current.attempts >= 10;
      this.outbox.transition(operation.operationId, failed ? 'FAILED' : 'PENDING', {
        error: error.message,
        nextAttemptAt: failed ? undefined : new Date(Date.now() + delayFor(current.attempts)),
      });
      this.logger.warn({
        event: 'sync.failed',
        operationId: operation.operationId,
        attempts: current.attempts,
      });
      return { status: failed ? 'FAILED' : 'PENDING', operationId: operation.operationId };
    }
  }
}
