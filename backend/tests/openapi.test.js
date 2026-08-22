import { describe, expect, it } from 'vitest';
import SwaggerParser from '@apidevtools/swagger-parser';
import { openApiDocument } from '../src/docs/openapi.js';

const expectedOperations = [
  'GET /health',
  'GET /health/live',
  'GET /health/ready',
  'POST /auth/login',
  'POST /auth/logout',
  'GET /auth/me',
  'GET /users',
  'POST /users',
  'PATCH /users/{id}/password',
  'PATCH /users/{id}/status',
  'GET /products',
  'POST /products',
  'GET /products/lookup/{code}',
  'GET /products/{id}',
  'PATCH /products/{id}',
  'PATCH /products/{id}/status',
  'GET /categories',
  'POST /categories',
  'PATCH /categories/{id}/status',
  'GET /locations',
  'POST /locations',
  'PATCH /locations/{id}/status',
  'GET /inventory/movements',
  'POST /inventory/movements',
  'GET /dashboard',
  'GET /audit',
  'GET /sync/operations',
  'POST /sync/operations/{id}/retry',
  'POST /sync/conflicts/{id}/resolve',
];

describe('OpenAPI', () => {
  it('is a valid and fully resolvable OpenAPI document', async () => {
    await expect(SwaggerParser.validate(openApiDocument)).resolves.toBeDefined();
  });

  it('documents every public API operation', () => {
    const actual = Object.entries(openApiDocument.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(actual.sort()).toEqual(expectedOperations.sort());
  });

  it('declares cookie authentication and reusable error responses', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.components.securitySchemes.cookieSession.name).toBe('stock.sid');
    expect(Object.keys(openApiDocument.components.responses)).toEqual(
      expect.arrayContaining(['BadRequest', 'Unauthorized', 'Forbidden', 'NotFound', 'Conflict']),
    );
  });
});
