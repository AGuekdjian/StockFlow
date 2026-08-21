import { describe, expect, it } from 'vitest';
import { stockMovementSchema } from '@stock-control/shared';

const valid = {
  operationId: 'cff0f06c-85ab-472f-9284-6cf8637fe614',
  productId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  type: 'OUT',
  quantity: 1,
  reason: 'Instalación',
};
describe('stock movement contract', () => {
  it.each([0, -1, 1.5])('rejects invalid quantity %s', (quantity) => {
    expect(stockMovementSchema.safeParse({ ...valid, quantity }).success).toBe(false);
  });
  it('requires a known OUT reason', () => {
    expect(stockMovementSchema.safeParse({ ...valid, reason: 'arbitrary' }).success).toBe(false);
  });
  it('requires exactly one serial number per serialized unit submission', () => {
    expect(
      stockMovementSchema.safeParse({ ...valid, quantity: 2, serialNumbers: ['SER-1'] }).success,
    ).toBe(false);
  });
  it('accepts UUID operation IDs and rejects malformed values', () => {
    expect(stockMovementSchema.safeParse(valid).success).toBe(true);
    expect(stockMovementSchema.safeParse({ ...valid, operationId: 'duplicate' }).success).toBe(
      false,
    );
  });
});
