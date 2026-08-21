import { StockMovement } from './stock-movement.model.js';
import { Product } from '../products/product.model.js';
import mongoose from 'mongoose';
export class DashboardRepository {
  async summary(user) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const movementFilter =
      user.role === 'ADMIN' ? {} : { userId: new mongoose.Types.ObjectId(user.id) };
    const [today, lowStock, outOfStock, latest] = await Promise.all([
      StockMovement.aggregate([
        { $match: { ...movementFilter, createdAt: { $gte: start } } },
        { $group: { _id: '$type', quantity: { $sum: '$quantity' } } },
      ]),
      Product.countDocuments({
        active: true,
        stock: { $gt: 0 },
        $expr: { $lte: ['$stock', '$minimumStock'] },
      }),
      Product.countDocuments({ active: true, stock: 0 }),
      StockMovement.find(movementFilter)
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('productId', 'name internalCode')
        .populate('userId', 'name')
        .lean(),
    ]);
    const totals = Object.fromEntries(today.map((item) => [item._id, item.quantity]));
    return {
      outputsToday: totals.OUT ?? 0,
      inputsToday: user.role === 'ADMIN' ? (totals.IN ?? 0) : null,
      lowStock,
      outOfStock,
      latest,
    };
  }
}
