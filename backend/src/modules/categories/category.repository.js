import { Category } from './category.model.js';
export class CategoryRepository {
  list() {
    return Category.find().sort({ name: 1 }).lean();
  }
  create(input) {
    return Category.create(input).then((value) => value.toJSON());
  }
  setActive(id, active) {
    return Category.findByIdAndUpdate(id, { $set: { active } }, { new: true }).lean();
  }
}
