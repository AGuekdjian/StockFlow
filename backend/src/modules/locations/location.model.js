import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);
export const Location = mongoose.models.Location ?? mongoose.model('Location', schema);
