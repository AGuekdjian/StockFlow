import { normalizeScannedCode } from '@stock-control/shared/code-normalization';

const DATABASE = 'stock-control';
const VERSION = 2;
const STORE = 'pending-requests';
const PRODUCTS = 'products';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE, { keyPath: 'operationId' });
      if (!request.result.objectStoreNames.contains(PRODUCTS)) {
        const products = request.result.createObjectStore(PRODUCTS, { keyPath: '_id' });
        products.createIndex('internalCode', 'internalCode', { unique: true });
        products.createIndex('barcodes', 'barcodes', { unique: false, multiEntry: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, action, storeName = STORE) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => database.close();
  });
}

export const browserOutbox = {
  put(value) {
    return transaction('readwrite', (store) => store.put(value));
  },
  remove(operationId) {
    return transaction('readwrite', (store) => store.delete(operationId));
  },
  all() {
    return transaction('readonly', (store) => store.getAll());
  },
};

export const productCache = {
  async putMany(values) {
    for (const value of values)
      await transaction('readwrite', (store) => store.put(value), PRODUCTS);
  },
  async findByCode(code) {
    const normalizedCode = normalizeScannedCode(code);
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(PRODUCTS, 'readonly');
      const store = tx.objectStore(PRODUCTS);
      const internal = store.index('internalCode').get(normalizedCode.toUpperCase());
      internal.onsuccess = () => {
        if (internal.result) {
          database.close();
          resolve(internal.result);
          return;
        }
        const barcode = store.index('barcodes').get(normalizedCode);
        barcode.onsuccess = () => {
          database.close();
          resolve(barcode.result);
        };
        barcode.onerror = () => reject(barcode.error);
      };
      internal.onerror = () => reject(internal.error);
    });
  },
};
