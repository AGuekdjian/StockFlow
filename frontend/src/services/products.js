import { api } from './api.js';
import { productCache } from '../offline/indexedDb.js';
export async function lookupProduct(code) {
  try {
    const { product } = await api(`/products/lookup/${encodeURIComponent(code)}`);
    await productCache.putMany([product]);
    return { product, cached: false };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const product = await productCache.findByCode(code);
    if (!product) throw error;
    return { product, cached: true };
  }
}
export async function cacheProducts(items) {
  await productCache.putMany(items);
}
