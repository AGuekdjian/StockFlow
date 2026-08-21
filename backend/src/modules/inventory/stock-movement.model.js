import mongoose from 'mongoose';
import { MOVEMENT_TYPES } from '@stock-control/shared';

const schema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, unique: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    stockBefore: { type: Number, required: true, min: 0 },
    stockAfter: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    client: { type: String, trim: true },
    jobNumber: { type: String, trim: true },
    observation: { type: String, trim: true },
    relatedMovementId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockMovement' },
    serialNumbers: { type: [String], default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ createdAt: -1, _id: -1 });
schema.index({ productId: 1, createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  schema.pre(operation, function rejectMutation() {
    throw new Error('StockMovement is append-only');
  });
}
export const StockMovement =
  mongoose.models.StockMovement ?? mongoose.model('StockMovement', schema);
