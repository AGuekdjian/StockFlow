import { Location } from './location.model.js';
export class LocationRepository {
  list() {
    return Location.find().sort({ code: 1 }).lean();
  }
  create(input) {
    return Location.create(input).then((value) => value.toJSON());
  }
  setActive(id, active) {
    return Location.findByIdAndUpdate(id, { $set: { active } }, { new: true }).lean();
  }
}
