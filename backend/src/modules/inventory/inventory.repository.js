import mongoose from 'mongoose';
import { Product } from '../products/product.model.js';
import { StockMovement } from './stock-movement.model.js';
import { AuditLog } from '../audit/audit-log.model.js';
import { User } from '../users/user.model.js';

const decreases = new Set(['OUT', 'ADJUSTMENT_OUT']);

export class InventoryRepository {
  findByOperationId(operationId) {
    return StockMovement.findOne({ operationId }).lean();
  }
  async execute(input, context) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const existing = await StockMovement.findOne({ operationId: input.operationId })
          .session(session)
          .lean();
        if (existing) {
          result = existing;
          return;
        }
        const actor = await User.exists({ _id: context.userId, active: true }).session(session);
        if (!actor) {
          const error = new Error('USER_INACTIVE');
          error.domainCode = 'USER_INACTIVE';
          throw error;
        }
        if (input.relatedMovementId) {
          const related = await StockMovement.findOne({
            _id: input.relatedMovementId,
            productId: input.productId,
          })
            .session(session)
            .lean();
          if (!related) {
            const error = new Error('RELATED_MOVEMENT_NOT_FOUND');
            error.domainCode = 'RELATED_MOVEMENT_NOT_FOUND';
            throw error;
          }
        }
        const decrement = decreases.has(input.type);
        const stockCondition =
          input.expectedStock !== undefined
            ? input.expectedStock
            : decrement
              ? { $gte: input.quantity }
              : undefined;
        const filter = {
          _id: input.productId,
          active: true,
          ...(stockCondition !== undefined ? { stock: stockCondition } : {}),
        };
        const before = await Product.findOneAndUpdate(
          filter,
          { $inc: { stock: decrement ? -input.quantity : input.quantity } },
          { new: false, session, runValidators: true },
        ).lean();
        if (!before) {
          const product = await Product.findById(input.productId).session(session).lean();
          if (!product) {
            const error = new Error('PRODUCT_NOT_FOUND');
            error.domainCode = 'PRODUCT_NOT_FOUND';
            throw error;
          }
          if (!product.active) {
            const error = new Error('PRODUCT_INACTIVE');
            error.domainCode = 'PRODUCT_INACTIVE';
            throw error;
          }
          if (input.expectedStock !== undefined && product.stock !== input.expectedStock) {
            const error = new Error('STOCK_CHANGED');
            error.domainCode = 'STOCK_CHANGED';
            error.details = { expected: input.expectedStock, current: product.stock };
            throw error;
          }
          const error = new Error('INSUFFICIENT_STOCK');
          error.domainCode = 'INSUFFICIENT_STOCK';
          error.details = { available: product.stock, requested: input.quantity };
          throw error;
        }
        if (input.serialNumbers && !before.serializable) {
          const error = new Error('PRODUCT_NOT_SERIALIZABLE');
          error.domainCode = 'PRODUCT_NOT_SERIALIZABLE';
          throw error;
        }
        const stockAfter = before.stock + (decrement ? -input.quantity : input.quantity);
        [result] = await StockMovement.create(
          [{ ...input, userId: context.userId, stockBefore: before.stock, stockAfter }],
          { session },
        );
        await AuditLog.create(
          [
            {
              userId: context.userId,
              action: `INVENTORY_${input.type}`,
              entity: 'StockMovement',
              entityId: result._id,
              changes: { stock: { from: before.stock, to: stockAfter } },
              reason: input.reason,
              requestId: context.requestId,
              operationId: input.operationId,
            },
          ],
          { session },
        );
        result = result.toJSON();
      });
      return result;
    } catch (error) {
      if (error?.code === 11000) return this.findByOperationId(input.operationId);
      throw error;
    } finally {
      await session.endSession();
    }
  }
  async list({ page, limit, filter }) {
    return Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('productId', 'name internalCode')
        .populate('userId', 'name email')
        .lean(),
      StockMovement.countDocuments(filter),
    ]);
  }
}
