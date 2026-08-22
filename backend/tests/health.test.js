import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openSqlite } from '../src/infrastructure/sqlite/sqlite.js';
import express from 'express';
import { z } from 'zod';
import { validate } from '../src/middlewares/validation.middleware.js';

const databases = [];
function fixture(available = false) {
  const sqlite = openSqlite(':memory:');
  databases.push(sqlite);
  const logger = { info() {}, warn() {}, error() {} };
  return createApp({
    env: { FRONTEND_ORIGIN: 'http://localhost:5173', NODE_ENV: 'test' },
    logger,
    mongo: { available },
    sqlite,
  });
}
afterEach(() => {
  while (databases.length) databases.pop().close();
});
describe('GET /api/health', () => {
  it('serves interactive API documentation and its OpenAPI document', async () => {
    const app = fixture();
    const docs = await request(app).get('/api/docs').expect(200);
    expect(docs.text).toContain('StockFlow API');
    const specification = await request(app).get('/api/openapi.json').expect(200);
    expect(specification.body.openapi).toBe('3.1.0');
    expect(specification.body.paths['/inventory/movements'].post).toBeDefined();
  });

  it('reports degraded status and outbox counts when MongoDB is offline', async () => {
    const response = await request(fixture()).get('/api/health').expect(200);
    expect(response.body.data).toEqual({
      status: 'degraded',
      api: 'ok',
      mongodb: 'offline',
      outbox: { pending: 0, syncing: 0, failed: 0, conflicts: 0 },
      version: '1.0.0',
    });
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });
  it('returns the consistent public error envelope', async () => {
    const response = await request(fixture()).get('/missing').expect(404);
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Recurso no encontrado.',
    });
    expect(response.body.error.requestId).toMatch(/^req_/);
  });
  it('supports validated query parameters on Express 5', async () => {
    const isolated = express();
    isolated.get(
      '/query-test',
      validate(z.object({ page: z.coerce.number().int() }), 'query'),
      (req, res) => res.json({ data: req.query }),
    );
    const response = await request(isolated).get('/query-test?page=2').expect(200);
    expect(response.body.data.page).toBe(2);
  });
  it('rejects state-changing browser requests from a foreign origin', async () => {
    const response = await request(fixture())
      .post('/api/auth/login')
      .set('origin', 'https://evil.example')
      .send({})
      .expect(403);
    expect(response.body.error.code).toBe('INVALID_ORIGIN');
  });
});
