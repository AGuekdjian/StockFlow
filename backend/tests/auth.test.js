import argon2 from 'argon2';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openSqlite } from '../src/infrastructure/sqlite/sqlite.js';
import { AuthService } from '../src/modules/auth/auth.service.js';

const sqlite = openSqlite(':memory:');
const logger = { info() {}, warn() {}, error() {} };
const password = 'correct-password';
const adminId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const techId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
let passwordHash;
let updatedPasswordHash;
const records = [
  { _id: adminId, name: 'Admin', email: 'admin@example.com', role: 'ADMIN', active: true },
  { _id: techId, name: 'Tech', email: 'tech@example.com', role: 'TECHNICIAN', active: true },
  {
    _id: 'cccccccccccccccccccccccc',
    name: 'Off',
    email: 'off@example.com',
    role: 'TECHNICIAN',
    active: false,
  },
];
const users = {
  async findByEmailWithPassword(email) {
    const found = records.find((item) => item.email === email);
    return found ? { ...found, passwordHash } : null;
  },
  async list() {
    return [records, records.length];
  },
  async create(value) {
    return { _id: 'new-id', ...value, passwordHash: undefined };
  },
  async setActive() {
    return null;
  },
  async setPassword(id, value) {
    updatedPasswordHash = value;
    return records.find((item) => item._id === id) ?? null;
  },
};
let app;
beforeAll(async () => {
  passwordHash = await argon2.hash(password);
  const authService = new AuthService({ users, logger });
  app = createApp({
    env: {
      FRONTEND_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
      SESSION_SECRET: '12345678901234567890123456789012',
    },
    logger,
    mongo: { available: true },
    sqlite,
    users,
    authService,
  });
});
afterAll(() => sqlite.close());
describe('authentication and authorization', () => {
  it('logs in and exposes the session without password data', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password })
      .expect(200);
    expect(login.body.data.user).not.toHaveProperty('passwordHash');
    await agent.get('/api/auth/me').expect(200);
  });
  it('rejects an incorrect password and inactive user with the same safe response', async () => {
    for (const body of [
      { email: 'admin@example.com', password: 'wrong-pass' },
      { email: 'off@example.com', password },
    ]) {
      const response = await request(app).post('/api/auth/login').send(body).expect(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    }
  });
  it('allows ADMIN and denies TECHNICIAN user management', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@example.com', password });
    await admin.get('/api/users').expect(200);
    const tech = request.agent(app);
    await tech.post('/api/auth/login').send({ email: 'tech@example.com', password });
    const response = await tech.get('/api/users').expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
  it('allows only ADMIN to reset a password without exposing its hash', async () => {
    const admin = request.agent(app);
    await admin.post('/api/auth/login').send({ email: 'admin@example.com', password });
    const response = await admin
      .patch(`/api/users/${techId}/password`)
      .send({ password: 'new-password-123' })
      .expect(200);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(await argon2.verify(updatedPasswordHash, 'new-password-123')).toBe(true);

    const tech = request.agent(app);
    await tech.post('/api/auth/login').send({ email: 'tech@example.com', password });
    await tech
      .patch(`/api/users/${adminId}/password`)
      .send({ password: 'another-password-123' })
      .expect(403);
  });
  it('does not expose any physical DELETE endpoint for movements', async () => {
    const response = await request(app)
      .delete('/api/inventory/movements/aaaaaaaaaaaaaaaaaaaaaaaa')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
