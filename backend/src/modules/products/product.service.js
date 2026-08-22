import { AppError } from '../../shared/errors/app-error.js';

function duplicateError(error) {
  if (error?.code !== 11000) return null;
  const field = Object.keys(error.keyPattern ?? error.keyValue ?? {})[0];
  if (field === 'barcodes')
    return new AppError({
      code: 'DUPLICATE_BARCODE',
      message: 'El código de barras ya pertenece a otro producto.',
      status: 409,
    });
  return new AppError({
    code: 'DUPLICATE_INTERNAL_CODE',
    message: 'El código interno ya existe.',
    status: 409,
  });
}

export class ProductService {
  constructor({ products, logger, audit }) {
    this.products = products;
    this.logger = logger;
    this.audit = audit;
  }
  async ensureReferences(categoryId, locationId) {
    const state = await this.products.referencesAreActive(categoryId, locationId);
    if (!state.category)
      throw new AppError({
        code: 'CATEGORY_NOT_FOUND',
        message: 'La categoría no existe o está inactiva.',
        status: 422,
      });
    if (!state.location)
      throw new AppError({
        code: 'LOCATION_NOT_FOUND',
        message: 'La ubicación no existe o está inactiva.',
        status: 422,
      });
    return state;
  }
  async create(input, context) {
    const references = await this.ensureReferences(input.categoryId, input.locationId);
    try {
      const productInput = { ...input };
      const categoryPrefix = references.category.code.replace(/-+$/, '');
      productInput.internalCode = await this.products.nextInternalCode(
        `${categoryPrefix}-`,
        productInput.categoryId,
      );
      const product = await this.products.create(productInput);
      this.logger.info({ event: 'product.created', productId: String(product._id), ...context });
      await this.audit?.record({
        ...context,
        action: 'PRODUCT_CREATED',
        entity: 'Product',
        entityId: product._id,
      });
      return product;
    } catch (error) {
      throw duplicateError(error) ?? error;
    }
  }
  async get(id) {
    const product = await this.products.findById(id);
    if (!product)
      throw new AppError({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Producto no encontrado.',
        status: 404,
      });
    return product;
  }
  list(query) {
    return this.products.list(query);
  }
  async update(id, input, context) {
    const current = await this.get(id);
    await this.ensureReferences(
      input.categoryId ?? current.categoryId,
      input.locationId ?? current.locationId,
    );
    try {
      const product = await this.products.update(id, input);
      this.logger.info({ event: 'product.updated', productId: id, ...context });
      const changes = Object.fromEntries(
        Object.entries(input).map(([key, value]) => [key, { from: current[key], to: value }]),
      );
      await this.audit?.record({
        ...context,
        action: 'PRODUCT_UPDATED',
        entity: 'Product',
        entityId: id,
        changes,
      });
      return product;
    } catch (error) {
      throw duplicateError(error) ?? error;
    }
  }
  async setActive(id, active, context) {
    await this.get(id);
    const product = await this.products.setActive(id, active);
    const action = active ? 'PRODUCT_REACTIVATED' : 'PRODUCT_DEACTIVATED';
    this.logger.info({
      event: active ? 'product.reactivated' : 'product.deactivated',
      productId: id,
      ...context,
    });
    await this.audit?.record({ ...context, action, entity: 'Product', entityId: id });
    return product;
  }
}
