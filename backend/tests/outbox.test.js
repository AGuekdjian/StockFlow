import { afterEach, describe, expect, it } from 'vitest';
import { openSqlite } from '../src/infrastructure/sqlite/sqlite.js';
import { OutboxRepository } from '../src/infrastructure/sqlite/outbox.repository.js';
import { StockOperationCoordinator } from '../src/modules/sync/stock-operation.coordinator.js';
import { SqliteSessionStore } from '../src/infrastructure/sqlite/session.store.js';
import { SyncManager } from '../src/modules/sync/sync.manager.js';

const databases = [];
afterEach(() => {
  while (databases.length) databases.pop().close();
});
function fixture() {
  const database = openSqlite(':memory:');
  databases.push(database);
  return new OutboxRepository(database);
}
describe('durable outbox state machine', () => {
  it('persists one intent for repeated operationId and claims it once', () => {
    const outbox = fixture();
    outbox.enqueue('op', 'OUT', { value: 1 });
    outbox.enqueue('op', 'OUT', { value: 2 });
    expect(outbox.claimNext().payload.value).toBe(1);
    expect(outbox.claimNext()).toBeNull();
  });
  it('rejects impossible transitions and recovers abandoned work', () => {
    const outbox = fixture();
    outbox.enqueue('op', 'OUT', {});
    expect(() => outbox.transition('op', 'SYNCED')).toThrow('Invalid');
    outbox.claim('op', new Date(0));
    expect(outbox.recoverAbandoned(new Date(1))).toBe(1);
    expect(outbox.get('op').status).toBe('PENDING');
  });
  it('accepts offline operations as PENDING without calling Mongo inventory', async () => {
    const outbox = fixture();
    let calls = 0;
    const coordinator = new StockOperationCoordinator({
      outbox,
      inventoryService: {
        async execute() {
          calls += 1;
        },
      },
      mongo: { available: false },
      logger: { info() {}, warn() {} },
    });
    const result = await coordinator.submit(
      { operationId: 'op', type: 'OUT' },
      { userId: 'user', role: 'TECHNICIAN' },
    );
    expect(result.status).toBe('PENDING');
    expect(calls).toBe(0);
  });
  it('checks backend permissions before accepting an offline intention', async () => {
    const outbox = fixture();
    const coordinator = new StockOperationCoordinator({
      outbox,
      inventoryService: {
        assertPermission() {
          const error = new Error('Forbidden');
          error.code = 'FORBIDDEN';
          throw error;
        },
      },
      mongo: { available: false },
      logger: { info() {}, warn() {} },
    });
    await expect(
      coordinator.submit({ operationId: 'op', type: 'IN' }, { userId: 'tech', role: 'TECHNICIAN' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(outbox.get('op')).toBeNull();
  });
  it('marks stock conflicts explicitly and retains their payload', async () => {
    const outbox = fixture();
    const coordinator = new StockOperationCoordinator({
      outbox,
      inventoryService: {
        async execute() {
          const error = new Error('Sin stock');
          error.code = 'INSUFFICIENT_STOCK';
          throw error;
        },
      },
      mongo: { available: true },
      logger: { info() {}, warn() {} },
    });
    const result = await coordinator.submit(
      { operationId: 'op', type: 'OUT' },
      { userId: 'user', role: 'TECHNICIAN' },
    );
    expect(result.status).toBe('CONFLICT');
    expect(outbox.get('op')).toMatchObject({
      status: 'CONFLICT',
      payload: { actor: { userId: 'user' } },
    });
  });
  it('keeps a resolved conflict visible with the explicit administrator decision', () => {
    const outbox = fixture();
    outbox.enqueue('conflict', 'OUT', { input: { quantity: 2 } });
    outbox.claim('conflict');
    outbox.transition('conflict', 'CONFLICT', { error: 'insufficient stock' });
    outbox.resolveConflict('conflict', {
      action: 'DISMISSED',
      reason: 'Mercadería no retirada',
      resolvedBy: 'admin',
    });
    const [items, total] = outbox.list({ status: 'CONFLICT', page: 1, limit: 20 });
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({
      status: 'CONFLICT',
      payload: { input: { quantity: 2 } },
      resolution: { action: 'DISMISSED', reason: 'Mercadería no retirada', resolvedBy: 'admin' },
    });
  });
  it('keeps authenticated sessions in local SQLite while Atlas is unavailable', async () => {
    const database = openSqlite(':memory:');
    databases.push(database);
    const store = new SqliteSessionStore(database);
    await new Promise((resolve, reject) =>
      store.set(
        'session',
        {
          cookie: { expires: new Date(Date.now() + 60_000) },
          user: { id: 'tech', role: 'TECHNICIAN' },
        },
        (error) => (error ? reject(error) : resolve()),
      ),
    );
    const value = await new Promise((resolve, reject) =>
      store.get('session', (error, session) => (error ? reject(error) : resolve(session))),
    );
    expect(value.user).toEqual({ id: 'tech', role: 'TECHNICIAN' });
  });
  it('invalidates every local session belonging to a deactivated user', async () => {
    const database = openSqlite(':memory:');
    databases.push(database);
    const store = new SqliteSessionStore(database);
    const save = (id, userId) =>
      new Promise((resolve, reject) =>
        store.set(
          id,
          { cookie: { expires: new Date(Date.now() + 60_000) }, user: { id: userId } },
          (error) => (error ? reject(error) : resolve()),
        ),
      );
    await save('tech-a', 'tech');
    await save('tech-b', 'tech');
    await save('admin', 'admin');
    expect(store.destroyUserSessions('tech')).toBe(2);
    const read = (id) =>
      new Promise((resolve, reject) =>
        store.get(id, (error, value) => (error ? reject(error) : resolve(value))),
      );
    await expect(read('tech-a')).resolves.toBeNull();
    await expect(read('admin')).resolves.toMatchObject({ user: { id: 'admin' } });
  });
  it('reconnects MongoDB when the backend started while Atlas was offline', async () => {
    const outbox = fixture();
    let connects = 0;
    const mongo = {
      available: false,
      async connect() {
        connects += 1;
        this.available = true;
      },
    };
    const manager = new SyncManager({
      outbox,
      mongo,
      coordinator: { process() {} },
      logger: { info() {} },
      intervalMs: 60_000,
    });
    manager.stopped = false;
    await manager.tick();
    await manager.stop();
    expect(connects).toBe(1);
  });
});
