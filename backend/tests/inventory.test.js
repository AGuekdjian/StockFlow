import { describe, expect, it } from 'vitest';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';

const input = {
  operationId: 'cff0f06c-85ab-472f-9284-6cf8637fe614',
  productId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  type: 'OUT',
  quantity: 1,
  reason: 'Instalación',
};
const logger = { info() {} };
function fixture(
  execute = async (value) => ({ _id: 'movement', stockBefore: 1, stockAfter: 0, ...value }),
) {
  return new InventoryService({ inventory: { execute, list: async () => [[], 0] }, logger });
}
describe('InventoryService', () => {
  it('allows technician OUT but rejects IN', async () => {
    await expect(
      fixture().execute(input, { userId: 'tech', role: 'TECHNICIAN' }),
    ).resolves.toMatchObject({ stockAfter: 0 });
    await expect(
      fixture().execute({ ...input, type: 'IN' }, { userId: 'tech', role: 'TECHNICIAN' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('maps insufficient stock with safe diagnostic details', async () => {
    const error = new Error();
    error.domainCode = 'INSUFFICIENT_STOCK';
    error.details = { available: 0, requested: 1 };
    await expect(
      fixture(async () => {
        throw error;
      }).execute(input, { userId: 'admin', role: 'ADMIN' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK', details: error.details });
  });
  it('limits technicians to their own movement history', async () => {
    let captured;
    const service = new InventoryService({
      inventory: {
        async list(value) {
          captured = value;
          return [[], 0];
        },
      },
      logger,
    });
    await service.list({ page: 1, limit: 20 }, { id: 'tech', role: 'TECHNICIAN' });
    expect(captured.filter.userId).toBe('tech');
  });
});
