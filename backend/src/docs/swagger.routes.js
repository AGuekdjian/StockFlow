import { Router, static as expressStatic } from 'express';
import { getAbsoluteFSPath } from 'swagger-ui-dist';
import { openApiDocument } from './openapi.js';

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StockFlow API</title><link rel="stylesheet" href="/api/docs/assets/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="/api/docs/assets/swagger-ui-bundle.js"></script>
<script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script><script src="/api/docs/init.js"></script></body></html>`;

const initializer = `window.ui=SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui',deepLinking:true,
presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],layout:'StandaloneLayout',displayRequestDuration:true,
requestInterceptor:function(request){request.credentials='include';return request;}});`;

export function swaggerRouter() {
  const router = Router();
  router.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  router.use('/docs/assets', expressStatic(getAbsoluteFSPath(), { immutable: true, maxAge: '1y' }));
  router.get('/docs/init.js', (_req, res) => res.type('application/javascript').send(initializer));
  router.get(['/docs', '/docs/'], (_req, res) => res.type('html').send(html));
  return router;
}
