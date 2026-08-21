import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserOutbox, productCache } from '../src/offline/indexedDb.js';
import { replayBrowserOutbox } from '../src/services/inventory.js';

afterEach(() => vi.restoreAllMocks());

describe('browser resilience storage', () => {
  it('keeps a movement until the backend acknowledges it', async () => {
    await browserOutbox.put({ operationId: 'browser-op', payload: { quantity: 2 } });
    expect(await browserOutbox.all()).toContainEqual({
      operationId: 'browser-op',
      payload: { quantity: 2 },
    });
    await browserOutbox.remove('browser-op');
    expect(await browserOutbox.all()).toEqual([]);
  });
  it('finds cached products by internal code and barcode', async () => {
    const product = {
      _id: 'product',
      internalCode: 'CAM-000001',
      barcodes: ['7790001'],
      name: 'Cámara',
    };
    await productCache.putMany([product]);
    await expect(productCache.findByCode('cam-000001')).resolves.toEqual(product);
    await expect(productCache.findByCode('7790001')).resolves.toEqual(product);
  });
  it('retains an unacknowledged movement when replay finds an expired session', async () => {
    await browserOutbox.put({
      operationId: 'needs-login',
      payload: { operationId: 'needs-login' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'UNAUTHORIZED', message: 'Login required' } }),
      }),
    );
    await replayBrowserOutbox();
    expect(await browserOutbox.all()).toContainEqual({
      operationId: 'needs-login',
      payload: { operationId: 'needs-login' },
    });
    await browserOutbox.remove('needs-login');
  });
});
