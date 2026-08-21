import { AuditLog } from './audit-log.model.js';
export class AuditRepository {
  record(value) {
    return AuditLog.create(value);
  }
  async list({ page, limit, action, userId }) {
    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    return Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
  }
}
