import { api } from './api.js';
import { productCache } from '../offline/indexedDb.js';
import { normalizeScannedCode } from '@stock-control/shared/code-normalization';
export async function lookupProduct(code) {
  const normalizedCode = normalizeScannedCode(code);
  try {
    const { product } = await api(`/products/lookup/${encodeURIComponent(normalizedCode)}`);
    await productCache.putMany([product]);
    return { product, cached: false };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const product = await productCache.findByCode(normalizedCode);
    if (!product) throw error;
    return { product, cached: true };
  }
}
export async function cacheProducts(items) {
  await productCache.putMany(items);
}
