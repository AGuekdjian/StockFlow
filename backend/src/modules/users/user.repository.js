import { User } from './user.model.js';

export class UserRepository {
  findByEmailWithPassword(email) {
    return User.findOne({ email: email.toLowerCase() }).select('+passwordHash').lean();
  }
  findById(id) {
    return User.findById(id).lean();
  }
  create(input) {
    return User.create(input).then((user) => user.toJSON());
  }
  list({ page, limit }) {
    return Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(),
    ]);
  }
  setActive(id, active) {
    return User.findByIdAndUpdate(
      id,
      { $set: { active } },
      { new: true, runValidators: true },
    ).lean();
  }
}
