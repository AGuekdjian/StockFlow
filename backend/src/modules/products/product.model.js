import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    internalCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    barcodes: { type: [String], default: [] },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    brand: { type: String, trim: true, maxlength: 100, default: '' },
    model: { type: String, trim: true, maxlength: 100, default: '' },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    stock: { type: Number, required: true, min: 0, default: 0 },
    minimumStock: { type: Number, required: true, min: 0, default: 0 },
    serializable: { type: Boolean, default: false },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);
schema.index(
  { barcodes: 1 },
  { unique: true, partialFilterExpression: { barcodes: { $type: 'string' } } },
);
schema.index({ name: 'text', brand: 'text', model: 'text', internalCode: 'text' });
schema.index({ name: 1, _id: 1 });
schema.index({ active: 1, stock: 1 });
export const Product = mongoose.models.Product ?? mongoose.model('Product', schema);
