import mongoose from 'mongoose';
import { ROLES } from '../auth/permissions.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

userSchema.set('toJSON', {
  transform(_doc, value) {
    delete value.passwordHash;
    return value;
  },
});
userSchema.index({ createdAt: -1, _id: -1 });
export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
