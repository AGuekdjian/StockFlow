import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    changes: { type: mongoose.Schema.Types.Mixed },
    reason: String,
    requestId: String,
    operationId: { type: String, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);
schema.index({ createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
]) {
  schema.pre(operation, function rejectMutation() {
    throw new Error('AuditLog is immutable');
  });
}
export const AuditLog = mongoose.models.AuditLog ?? mongoose.model('AuditLog', schema);
