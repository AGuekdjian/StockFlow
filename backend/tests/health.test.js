import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openSqlite } from '../src/infrastructure/sqlite/sqlite.js';
import express from 'express';
import { z } from 'zod';
import { validate } from '../src/middlewares/validation.middleware.js';
import { PRODUCT } from '../src/config/product.js';

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
      outbox: { pending: 0, syncing: 0, failed: 0, conflicts: 0, oldestUnresolvedAt: null },
      version: PRODUCT.version,
    });
    expect(response.headers['x-request-id']).toMatch(/^req_/);
  });
  it('separates process liveness from MongoDB readiness', async () => {
    const app = fixture(false);
    await request(app)
      .get('/api/health/live')
      .expect(200, {
        data: { status: 'alive', version: PRODUCT.version },
      });
    await request(app)
      .get('/api/health/ready')
      .expect(503, {
        data: { status: 'not_ready', mongodb: 'offline' },
      });
  });
  it('protects production documentation without protecting liveness', async () => {
    const sqlite = openSqlite(':memory:');
    databases.push(sqlite);
    const app = createApp({
      env: {
        FRONTEND_ORIGIN: 'http://localhost:8080',
        NODE_ENV: 'production',
        SESSION_SECRET: 'production-test-secret-at-least-32-characters',
      },
      logger: { info() {}, warn() {}, error() {} },
      mongo: { available: false },
      sqlite,
      authService: {},
      users: {},
    });
    await request(app).get('/api/docs').expect(401);
    await request(app).get('/api/health/live').expect(200);
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
