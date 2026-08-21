import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { openSqlite } from '../src/infrastructure/sqlite/sqlite.js';
import { SqliteSessionStore } from '../src/infrastructure/sqlite/session.store.js';
import { OutboxRepository } from '../src/infrastructure/sqlite/outbox.repository.js';
import { UserRepository } from '../src/modules/users/user.repository.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ProductRepository } from '../src/modules/products/product.repository.js';
import { ProductService } from '../src/modules/products/product.service.js';
import { CategoryRepository } from '../src/modules/categories/category.repository.js';
import { LocationRepository } from '../src/modules/locations/location.repository.js';
import { InventoryRepository } from '../src/modules/inventory/inventory.repository.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { StockOperationCoordinator } from '../src/modules/sync/stock-operation.coordinator.js';
import { AuditRepository } from '../src/modules/audit/audit.repository.js';
import { DashboardRepository } from '../src/modules/inventory/dashboard.repository.js';
import { seedDatabase } from '../src/modules/users/seed.js';

const logger = { info() {}, warn() {}, error() {} };
const replica = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
await mongoose.connect(replica.getUri());
await seedDatabase({
  adminPassword: 'Admin-password-123!',
  technicianPassword: 'Tech-password-123!',
});
const sqlite = openSqlite(':memory:');
const mongo = { available: true };
const users = new UserRepository();
const authService = new AuthService({ users, logger });
const productService = new ProductService({ products: new ProductRepository(), logger });
const inventoryService = new InventoryService({ inventory: new InventoryRepository(), logger });
const outbox = new OutboxRepository(sqlite);
const coordinator = new StockOperationCoordinator({ outbox, inventoryService, mongo, logger });
const env = {
  FRONTEND_ORIGIN: 'http://127.0.0.1:5173',
  NODE_ENV: 'test',
  SESSION_SECRET: 'e2e-session-secret-at-least-32-characters',
};
const app = createApp({
  env,
  logger,
  mongo,
  sqlite,
  users,
  authService,
  sessionStore: new SqliteSessionStore(sqlite),
  productService,
  categories: new CategoryRepository(),
  locations: new LocationRepository(),
  inventoryService,
  coordinator,
  outbox,
  audit: new AuditRepository(),
  dashboard: new DashboardRepository(),
});
const server = app.listen(3000, '127.0.0.1', () => console.log('E2E API ready on 3000'));
async function stop() {
  server.close(async () => {
    sqlite.close();
    await mongoose.disconnect();
    await replica.stop();
    process.exit(0);
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
