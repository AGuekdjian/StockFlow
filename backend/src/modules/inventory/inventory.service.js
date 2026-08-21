import { AppError } from '../../shared/errors/app-error.js';
import { roleHasPermission, PERMISSIONS } from '../auth/permissions.js';

const typePermissions = {
  IN: PERMISSIONS.STOCK_IN,
  OUT: PERMISSIONS.STOCK_OUT,
  RETURN: PERMISSIONS.STOCK_RETURN,
  ADJUSTMENT_IN: PERMISSIONS.STOCK_ADJUST,
  ADJUSTMENT_OUT: PERMISSIONS.STOCK_ADJUST,
};
const publicErrors = {
  PRODUCT_NOT_FOUND: ['Producto no encontrado.', 404],
  PRODUCT_INACTIVE: ['El producto está inactivo.', 409],
  USER_INACTIVE: ['El usuario ya no está habilitado.', 409],
  RELATED_MOVEMENT_NOT_FOUND: [
    'El movimiento relacionado no existe o pertenece a otro producto.',
    422,
  ],
  INSUFFICIENT_STOCK: ['No hay stock suficiente.', 409],
  STOCK_CHANGED: ['El stock cambió durante el conteo; volvé a contar antes de ajustar.', 409],
  PRODUCT_NOT_SERIALIZABLE: ['El producto no admite números de serie.', 422],
};

export class InventoryService {
  constructor({ inventory, logger }) {
    this.inventory = inventory;
    this.logger = logger;
  }
  assertPermission(input, context) {
    if (!roleHasPermission(context.role, typePermissions[input.type]))
      throw new AppError({
        code: 'FORBIDDEN',
        message: 'No tenés permiso para registrar este movimiento.',
        status: 403,
      });
  }
  async execute(input, context) {
    this.assertPermission(input, context);
    try {
      const movement = await this.inventory.execute(input, context);
      this.logger.info({
        event: `inventory.${input.type.toLowerCase()}`,
        operationId: input.operationId,
        productId: input.productId,
        userId: context.userId,
        requestId: context.requestId,
      });
      return movement;
    } catch (error) {
      const mapping = publicErrors[error.domainCode];
      if (mapping)
        throw new AppError({
          code: error.domainCode,
          message: mapping[0],
          status: mapping[1],
          details: error.details,
        });
      throw error;
    }
  }
  async list(query, user) {
    const filter = {};
    if (user.role !== 'ADMIN') filter.userId = user.id;
    else if (query.userId) filter.userId = query.userId;
    if (query.type) filter.type = query.type;
    if (query.productId) filter.productId = query.productId;
    if (query.operationId) filter.operationId = query.operationId;
    if (query.reason)
      filter.reason = {
        $regex: query.reason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    if (query.client)
      filter.client = {
        $regex: query.client.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    if (query.dateFrom || query.dateTo)
      filter.createdAt = {
        ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { $lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
      };
    const [items, total] = await this.inventory.list({ ...query, filter });
    return [items.map((item) => ({ ...item, syncStatus: 'SYNCED' })), total];
  }
}
