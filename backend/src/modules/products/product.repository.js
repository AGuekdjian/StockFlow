import { Product } from './product.model.js';
import { Category } from '../categories/category.model.js';
import { Location } from '../locations/location.model.js';

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
