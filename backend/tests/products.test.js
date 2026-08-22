import { describe, expect, it } from 'vitest';
import { ProductService } from '../src/modules/products/product.service.js';

const valid = {
  internalCode: 'CAM-000001',
  barcodes: ['7790001'],
  name: 'Cámara',
  categoryId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  locationId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
};
const logger = { info() {} };
function fixture(overrides = {}) {
  const products = {
    async referencesAreActive() {
      return { category: true, location: true };
    },
    async create(input) {
      return { _id: 'product-id', stock: 0, active: true, ...input };
    },
    async nextInternalCode(prefix) {
      return `${prefix}000002`;
    },
    async findById() {
      return { _id: 'product-id', ...valid, stock: 0, active: true };
    },
    async update(id, input) {
      return { _id: id, ...valid, ...input };
    },
    async setActive(id, active) {
      return { _id: id, ...valid, active };
    },
    ...overrides,
  };
  return new ProductService({ products, logger });
}
describe('ProductService', () => {
  it('creates products at stock zero and validates references', async () => {
    const product = await fixture().create(valid, {});
    expect(product.stock).toBe(0);
  });
  it('assigns the next atomic sequence when only a prefix is entered', async () => {
    const product = await fixture().create({ ...valid, internalCode: 'CAM-' }, {});
    expect(product.internalCode).toBe('CAM-000002');
  });
  it.each([
    ['internalCode', 'DUPLICATE_INTERNAL_CODE'],
    ['barcodes', 'DUPLICATE_BARCODE'],
  ])('maps duplicate %s indexes', async (field, code) => {
    const service = fixture({
      async create() {
        const error = new Error('duplicate');
        error.code = 11000;
        error.keyPattern = { [field]: 1 };
        throw error;
      },
    });
    await expect(service.create(valid, {})).rejects.toMatchObject({ code, status: 409 });
  });
  it('rejects inactive category references', async () => {
    const service = fixture({
      async referencesAreActive() {
        return { category: false, location: true };
      },
    });
    await expect(service.create(valid, {})).rejects.toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
  });
  it('deactivates without deleting the product', async () => {
    await expect(fixture().setActive('product-id', false, {})).resolves.toMatchObject({
      active: false,
    });
  });
});
