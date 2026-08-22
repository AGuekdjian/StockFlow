import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, min: 0 },
  },
  { versionKey: false },
);

export const ProductCodeCounter =
  mongoose.models.ProductCodeCounter ?? mongoose.model('ProductCodeCounter', schema);
