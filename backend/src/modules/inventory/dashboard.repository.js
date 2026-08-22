import { StockMovement } from './stock-movement.model.js';
import { Product } from '../products/product.model.js';
import mongoose from 'mongoose';
export class DashboardRepository {
  async summary(user) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const movementFilter =
      user.role === 'ADMIN' ? {} : { userId: new mongoose.Types.ObjectId(user.id) };
    const [movementTotals, lowStock, outOfStock, latest] = await Promise.all([
      StockMovement.aggregate([
        { $match: { ...movementFilter, createdAt: { $gte: monthStart } } },
        {
          $group: {
            _id: '$type',
            month: { $sum: '$quantity' },
            today: {
              $sum: { $cond: [{ $gte: ['$createdAt', start] }, '$quantity', 0] },
            },
          },
        },
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
    const totals = Object.fromEntries(movementTotals.map((item) => [item._id, item]));
    return {
      outputsToday: totals.OUT?.today ?? 0,
      inputsToday: user.role === 'ADMIN' ? (totals.IN?.today ?? 0) : null,
      outputsMonth: totals.OUT?.month ?? 0,
      inputsMonth: user.role === 'ADMIN' ? (totals.IN?.month ?? 0) : null,
      lowStock,
      outOfStock,
      latest,
    };
  }
}
