import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InventoryRepository } from '../../src/modules/inventory/inventory.repository.js';
import { Product } from '../../src/modules/products/product.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { Category } from '../../src/modules/categories/category.model.js';
import { Location } from '../../src/modules/locations/location.model.js';
import { StockMovement } from '../../src/modules/inventory/stock-movement.model.js';
import { AuditLog } from '../../src/modules/audit/audit-log.model.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { openSqlite } from '../../src/infrastructure/sqlite/sqlite.js';
import { OutboxRepository } from '../../src/infrastructure/sqlite/outbox.repository.js';
import { InventoryService } from '../../src/modules/inventory/inventory.service.js';
import { StockOperationCoordinator } from '../../src/modules/sync/stock-operation.coordinator.js';
import { DashboardRepository } from '../../src/modules/inventory/dashboard.repository.js';
import { ProductRepository } from '../../src/modules/products/product.repository.js';

let replica;
let repository;
let userId;
let productId;
const operation = (id) => ({
  operationId: id,
  productId: String(productId),
  type: 'OUT',
  quantity: 1,
  reason: 'Instalación',
});

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    instanceOpts: [{ launchTimeout: 60_000 }],
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replica.getUri());
  const [category, location, user] = await Promise.all([
    Category.create({ name: 'Cámaras', code: 'CAM' }),
    Location.create({ name: 'Estante', code: 'A-01' }),
    User.create({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'not-used',
      role: 'ADMIN',
    }),
  ]);
  userId = user._id;
  const product = await Product.create({
    internalCode: 'CAM-000001',
    name: 'Cámara',
    categoryId: category._id,
    locationId: location._id,
    stock: 1,
  });
  productId = product._id;
  repository = new InventoryRepository();
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await replica?.stop();
}, 30_000);

describe('InventoryRepository transactions', () => {
  it('lets exactly one of two concurrent technicians consume the final unit', async () => {
    const results = await Promise.allSettled([
      repository.execute(operation('b70e4db3-f26a-43ad-ad85-b46834747811'), {
        userId,
        requestId: 'req_a',
      }),
      repository.execute(operation('19296593-f7e3-44ac-84fa-7e9a7cb88666'), {
        userId,
        requestId: 'req_b',
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')[0].reason.domainCode).toBe(
      'INSUFFICIENT_STOCK',
    );
    expect((await Product.findById(productId).lean()).stock).toBe(0);
    expect(await StockMovement.countDocuments({ productId })).toBe(1);
    expect(await AuditLog.countDocuments()).toBe(1);
  });

  it('applies the same operationId only once across five retries', async () => {
    await Product.updateOne({ _id: productId }, { $set: { stock: 5 } });
    const input = operation('a6490e46-5d13-4955-9a58-738b8afd6f44');
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        repository.execute(input, { userId, requestId: 'req_retry' }),
      ),
    );
    expect(new Set(results.map((result) => String(result._id))).size).toBe(1);
    expect((await Product.findById(productId).lean()).stock).toBe(4);
    expect(await StockMovement.countDocuments({ operationId: input.operationId })).toBe(1);
  });

  it('enforces append-only movement storage', async () => {
    await expect(StockMovement.deleteOne({ productId })).rejects.toThrow('append-only');
    expect(await StockMovement.countDocuments({ productId })).toBeGreaterThan(0);
  });

  it('survives an offline backend restart and synchronizes exactly once after recovery', async () => {
    const path = join(tmpdir(), `stock-outbox-${randomUUID()}.sqlite`);
    const operationId = '7a36aacd-6cbc-42ca-84d8-5ec44e7d724e';
    const input = operation(operationId);
    const logger = { info() {}, warn() {} };
    const inventoryService = new InventoryService({ inventory: repository, logger });
    let sqlite = openSqlite(path);
    let coordinator = new StockOperationCoordinator({
      outbox: new OutboxRepository(sqlite),
      inventoryService,
      mongo: { available: false },
      logger,
    });
    expect(
      await coordinator.submit(input, {
        userId: String(userId),
        role: 'ADMIN',
        requestId: 'req_offline',
      }),
    ).toMatchObject({ status: 'PENDING' });
    sqlite.close();

    sqlite = openSqlite(path);
    const outbox = new OutboxRepository(sqlite);
    expect(outbox.get(operationId).status).toBe('PENDING');
    coordinator = new StockOperationCoordinator({
      outbox,
      inventoryService,
      mongo: { available: true },
      logger,
    });
    expect(
      await coordinator.submit(input, {
        userId: String(userId),
        role: 'ADMIN',
        requestId: 'req_recovered',
      }),
    ).toMatchObject({ status: 'SYNCED' });
    expect(
      await coordinator.submit(input, {
        userId: String(userId),
        role: 'ADMIN',
        requestId: 'req_retry',
      }),
    ).toMatchObject({ status: 'SYNCED' });
    expect(await StockMovement.countDocuments({ operationId })).toBe(1);
    sqlite.close();
    for (const suffix of ['', '-shm', '-wal']) rmSync(`${path}${suffix}`, { force: true });
  });

  it('records IN, RETURN and both adjustment directions with exact stock snapshots', async () => {
    const product = await Product.create({
      internalCode: 'ACC-000002',
      name: 'Accesorio',
      categoryId: (await Category.findOne())._id,
      locationId: (await Location.findOne())._id,
      stock: 2,
    });
    const context = { userId, requestId: 'req_types' };
    const inputs = [
      { type: 'IN', quantity: 3, before: 2, after: 5 },
      { type: 'RETURN', quantity: 1, before: 5, after: 6 },
      { type: 'ADJUSTMENT_OUT', quantity: 2, before: 6, after: 4 },
      { type: 'ADJUSTMENT_IN', quantity: 1, before: 4, after: 5 },
    ];
    for (const item of inputs) {
      const movement = await repository.execute(
        {
          operationId: randomUUID(),
          productId: String(product._id),
          type: item.type,
          quantity: item.quantity,
          reason: 'Prueba controlada',
        },
        context,
      );
      expect(movement).toMatchObject({
        type: item.type,
        stockBefore: item.before,
        stockAfter: item.after,
      });
    }
    expect((await Product.findById(product._id).lean()).stock).toBe(5);
    expect(
      await AuditLog.countDocuments({
        entityId: { $in: await StockMovement.find({ productId: product._id }).distinct('_id') },
      }),
    ).toBe(4);
  });

  it('rejects inactive and nonexistent products without creating movements', async () => {
    const inactive = await Product.create({
      internalCode: 'ACC-000003',
      name: 'Inactivo',
      categoryId: (await Category.findOne())._id,
      locationId: (await Location.findOne())._id,
      stock: 3,
      active: false,
    });
    await expect(
      repository.execute(
        {
          operationId: randomUUID(),
          productId: String(inactive._id),
          type: 'OUT',
          quantity: 1,
          reason: 'Instalación',
        },
        { userId, requestId: 'req_inactive' },
      ),
    ).rejects.toMatchObject({ domainCode: 'PRODUCT_INACTIVE' });
    await expect(
      repository.execute(
        {
          operationId: randomUUID(),
          productId: String(new mongoose.Types.ObjectId()),
          type: 'OUT',
          quantity: 1,
          reason: 'Instalación',
        },
        { userId, requestId: 'req_missing' },
      ),
    ).rejects.toMatchObject({ domainCode: 'PRODUCT_NOT_FOUND' });
    expect(await StockMovement.countDocuments({ productId: inactive._id })).toBe(0);
  });

  it('links corrections to the original movement and rejects unrelated history', async () => {
    const product = await Product.create({
      internalCode: 'ACC-000004',
      name: 'Corrección',
      categoryId: (await Category.findOne())._id,
      locationId: (await Location.findOne())._id,
      stock: 5,
    });
    const original = await repository.execute(
      {
        operationId: randomUUID(),
        productId: String(product._id),
        type: 'OUT',
        quantity: 2,
        reason: 'Instalación',
      },
      { userId, requestId: 'req_original' },
    );
    const correction = await repository.execute(
      {
        operationId: randomUUID(),
        productId: String(product._id),
        type: 'RETURN',
        quantity: 1,
        reason: 'Corrección de cantidad',
        relatedMovementId: String(original._id),
      },
      { userId, requestId: 'req_correction' },
    );
    expect(String(correction.relatedMovementId)).toBe(String(original._id));
    expect((await Product.findById(product._id).lean()).stock).toBe(4);
    await expect(
      repository.execute(
        {
          operationId: randomUUID(),
          productId: String(product._id),
          type: 'RETURN',
          quantity: 1,
          reason: 'Corrección inválida',
          relatedMovementId: String(new mongoose.Types.ObjectId()),
        },
        { userId, requestId: 'req_bad_relation' },
      ),
    ).rejects.toMatchObject({ domainCode: 'RELATED_MOVEMENT_NOT_FOUND' });
  });

  it('turns a stale physical-count adjustment into a conflict instead of overwriting newer stock', async () => {
    const product = await Product.create({
      internalCode: 'ACC-000005',
      name: 'Conteo',
      categoryId: (await Category.findOne())._id,
      locationId: (await Location.findOne())._id,
      stock: 10,
    });
    await Product.updateOne({ _id: product._id }, { $inc: { stock: 1 } });
    await expect(
      repository.execute(
        {
          operationId: randomUUID(),
          productId: String(product._id),
          type: 'ADJUSTMENT_OUT',
          quantity: 2,
          reason: 'Conteo físico',
          expectedStock: 10,
        },
        { userId, requestId: 'req_count' },
      ),
    ).rejects.toMatchObject({
      domainCode: 'STOCK_CHANGED',
      details: { expected: 10, current: 11 },
    });
    expect((await Product.findById(product._id).lean()).stock).toBe(11);
  });

  it('allows many products without barcodes while enforcing real unique barcode and internal-code indexes', async () => {
    const categoryId = (await Category.findOne())._id;
    const locationId = (await Location.findOne())._id;
    await Product.create({
      internalCode: 'ACC-000006',
      name: 'Sin barcode A',
      categoryId,
      locationId,
    });
    await Product.create({
      internalCode: 'ACC-000007',
      name: 'Sin barcode B',
      categoryId,
      locationId,
    });
    await Product.create({
      internalCode: 'ACC-000008',
      barcodes: ['UNIQUE-BARCODE'],
      name: 'Con barcode',
      categoryId,
      locationId,
    });
    await expect(
      Product.create({
        internalCode: 'ACC-000009',
        barcodes: ['UNIQUE-BARCODE'],
        name: 'Duplicado barcode',
        categoryId,
        locationId,
      }),
    ).rejects.toMatchObject({ code: 11000 });
    const repository = new ProductRepository();
    await expect(repository.findByCode('SN>UNIQUE-BARCODE')).resolves.toMatchObject({
      internalCode: 'ACC-000008',
    });
    await expect(
      Product.create({
        internalCode: 'ACC-000008',
        name: 'Duplicado interno',
        categoryId,
        locationId,
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('generates consecutive category codes without duplicates under concurrency', async () => {
    const categoryId = (await Category.findOne())._id;
    const productRepository = new ProductRepository();
    const codes = await Promise.all(
      Array.from({ length: 5 }, () => productRepository.nextInternalCode('CAM-', categoryId)),
    );
    expect(new Set(codes).size).toBe(5);
    expect(codes.sort()).toEqual([
      'CAM-000002',
      'CAM-000003',
      'CAM-000004',
      'CAM-000005',
      'CAM-000006',
    ]);
  });

  it('restricts a technician dashboard to their own recent movements', async () => {
    const [techA, techB] = await User.create([
      {
        name: 'Técnico A',
        email: 'tech-a@example.com',
        passwordHash: 'unused',
        role: 'TECHNICIAN',
      },
      {
        name: 'Técnico B',
        email: 'tech-b@example.com',
        passwordHash: 'unused',
        role: 'TECHNICIAN',
      },
    ]);
    const product = await Product.create({
      internalCode: 'ACC-000010',
      name: 'Dashboard',
      categoryId: (await Category.findOne())._id,
      locationId: (await Location.findOne())._id,
      stock: 4,
    });
    await repository.execute(
      {
        operationId: randomUUID(),
        productId: String(product._id),
        type: 'OUT',
        quantity: 1,
        reason: 'Instalación',
      },
      { userId: techA._id, requestId: 'req_tech_a' },
    );
    await repository.execute(
      {
        operationId: randomUUID(),
        productId: String(product._id),
        type: 'OUT',
        quantity: 1,
        reason: 'Instalación',
      },
      { userId: techB._id, requestId: 'req_tech_b' },
    );
    const summary = await new DashboardRepository().summary({
      id: String(techA._id),
      role: 'TECHNICIAN',
    });
    expect(summary.outputsToday).toBe(1);
    expect(summary.outputsMonth).toBe(1);
    expect(summary.inputsToday).toBeNull();
    expect(summary.inputsMonth).toBeNull();
    expect(summary.latest).toHaveLength(1);
    expect(String(summary.latest[0].userId._id)).toBe(String(techA._id));
  });
});
