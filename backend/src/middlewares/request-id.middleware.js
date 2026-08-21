import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(req, res, next) {
  const candidate = req.get('x-request-id');
  req.requestId =
    candidate && /^[a-zA-Z0-9_-]{8,100}$/.test(candidate) ? candidate : `req_${randomUUID()}`;
  res.set('x-request-id', req.requestId);
  next();
}
