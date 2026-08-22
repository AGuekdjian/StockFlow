import './config/load-dotenv.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './shared/logger/logger.js';
import { MongoConnection } from './infrastructure/mongodb/mongodb.js';
import { openSqlite } from './infrastructure/sqlite/sqlite.js';
import { createApp } from './app.js';
import { UserRepository } from './modules/users/user.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { ProductRepository } from './modules/products/product.repository.js';
import { ProductService } from './modules/products/product.service.js';
import { CategoryRepository } from './modules/categories/category.repository.js';
import { LocationRepository } from './modules/locations/location.repository.js';
import { InventoryRepository } from './modules/inventory/inventory.repository.js';
import { InventoryService } from './modules/inventory/inventory.service.js';
import { SqliteSessionStore } from './infrastructure/sqlite/session.store.js';
import { OutboxRepository } from './infrastructure/sqlite/outbox.repository.js';
import { StockOperationCoordinator } from './modules/sync/stock-operation.coordinator.js';
import { SyncManager } from './modules/sync/sync.manager.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { DashboardRepository } from './modules/inventory/dashboard.repository.js';

const env = loadEnv();
const logger = createLogger({
  level: env.LOG_LEVEL,
  path: env.LOG_PATH,
  environment: env.NODE_ENV,
});
const sqlite = openSqlite(env.SQLITE_PATH);
const mongo = new MongoConnection({ uri: env.MONGODB_URI, logger });
if (env.MONGODB_CONNECT_ON_START) await mongo.connect();
const users = new UserRepository();
const authService = new AuthService({ users, logger });
const audit = new AuditRepository();
const productService = new ProductService({ products: new ProductRepository(), logger, audit });
const categories = new CategoryRepository();
const locations = new LocationRepository();
const inventoryService = new InventoryService({
  inventory: new InventoryRepository(),
  logger,
  timeZone: env.BUSINESS_TIME_ZONE,
});
const sessionStore = new SqliteSessionStore(sqlite);
const outbox = new OutboxRepository(sqlite);
const coordinator = new StockOperationCoordinator({ outbox, inventoryService, mongo, logger });
const dashboard = new DashboardRepository(env.BUSINESS_TIME_ZONE);
const syncManager = new SyncManager({
  outbox,
  coordinator,
  mongo,
  logger,
  intervalMs: env.SYNC_INTERVAL_MS,
  batchSize: env.SYNC_BATCH_SIZE,
  sessionStore,
  syncedRetentionDays: env.OUTBOX_SYNCED_RETENTION_DAYS,
});
const app = createApp({
  env,
  logger,
  mongo,
  sqlite,
  users,
  authService,
  sessionStore,
  productService,
  categories,
  locations,
  inventoryService,
  coordinator,
  outbox,
  audit,
  dashboard,
});
const server = app.listen(env.PORT, '0.0.0.0', () =>
  logger.info({ event: 'server.started', port: env.PORT }, 'Servidor iniciado'),
);
syncManager.start();

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ event: 'server.shutdown', signal }, 'Cierre ordenado iniciado');
  const forceTimer = setTimeout(() => {
    logger.error({ event: 'server.shutdown.timeout' }, 'Tiempo de cierre agotado');
    process.exit(1);
  }, 15_000).unref();
  try {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await syncManager.stop();
    await mongo.close();
    sqlite.close();
    clearTimeout(forceTimer);
    logger.info({ event: 'server.stopped' }, 'Servidor detenido');
    process.exit(0);
  } catch (error) {
    logger.error({ event: 'server.shutdown.failed', error: error.message });
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
