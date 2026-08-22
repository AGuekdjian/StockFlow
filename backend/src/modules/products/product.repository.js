import { Product } from './product.model.js';
import { Category } from '../categories/category.model.js';
import { Location } from '../locations/location.model.js';
import { ProductCodeCounter } from './product-code-counter.model.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class ProductRepository {
  async referencesAreActive(categoryId, locationId) {
    const [category, location] = await Promise.all([
      Category.exists({ _id: categoryId, active: true }),
      Location.exists({ _id: locationId, active: true }),
    ]);
    return { category: Boolean(category), location: Boolean(location) };
  }
  create(input) {
    return Product.create({ ...input, stock: 0 }).then((value) => value.toJSON());
  }
  async nextInternalCode(prefix, categoryId) {
    const latest = await Product.findOne({
      categoryId,
      internalCode: new RegExp(`^${escapeRegex(prefix)}\\d+$`),
    })
      .sort({ internalCode: -1 })
      .select('internalCode')
      .lean();
    const currentMaximum = latest ? Number(latest.internalCode.slice(prefix.length)) || 0 : 0;
    const counterId = `${categoryId}:${prefix}`;
    try {
      await ProductCodeCounter.updateOne(
        { _id: counterId },
        { $max: { sequence: currentMaximum } },
        { upsert: true },
      );
    } catch (error) {
      // Two first requests may race while creating the counter. The winner has
      // already initialized it, so the losing request can safely continue.
      if (error?.code !== 11000) throw error;
    }
    const counter = await ProductCodeCounter.findByIdAndUpdate(
      counterId,
      { $inc: { sequence: 1 } },
      { new: true },
    ).lean();
    return `${prefix}${String(counter.sequence).padStart(6, '0')}`;
  }
  findById(id) {
    return Product.findById(id).lean();
  }
  findByCode(code) {
    return Product.findOne({
      $or: [{ internalCode: code.toUpperCase() }, { barcodes: code }],
    }).lean();
  }
  async list({ page, limit, active, search }) {
    const filter = {};
    if (active !== undefined) filter.active = active;
    if (search) filter.$text = { $search: search };
    return Promise.all([
      Product.find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);
  }
  update(id, values) {
    return Product.findByIdAndUpdate(
      id,
      { $set: values },
      { new: true, runValidators: true },
    ).lean();
  }
  setActive(id, active) {
    return this.update(id, { active });
  }
}
