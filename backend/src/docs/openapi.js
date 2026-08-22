const objectId = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{24}$',
  example: '64f1c2a3b4c5d6e7f8091234',
};
const dateTime = { type: 'string', format: 'date-time' };
const paginationParameters = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];
const json = (schema, description = 'Respuesta correcta') => ({
  description,
  content: { 'application/json': { schema } },
});
const data = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  required: ['data'],
  properties: { data: { type: 'object', required, properties } },
});
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const body = (schema, required = true) => ({
  required,
  content: { 'application/json': { schema } },
});
const secured = [{ cookieSession: [] }];
const commonErrors = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  429: { $ref: '#/components/responses/RateLimited' },
  500: { $ref: '#/components/responses/InternalError' },
};
const operation = ({ tag, summary, responses, ...rest }) => ({
  tags: [tag],
  summary,
  security: secured,
  responses: { ...responses, ...commonErrors },
  ...rest,
});
const idParameter = { name: 'id', in: 'path', required: true, schema: objectId };
const pagination = {
  type: 'object',
  required: ['page', 'limit', 'total'],
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1 },
    total: { type: 'integer', minimum: 0 },
  },
};

const namedEntityPaths = (tag, noun, schemaName) => ({
  get: operation({
    tag,
    summary: `Listar ${noun}`,
    responses: { 200: json(data({ items: { type: 'array', items: ref(schemaName) } })) },
  }),
  post: operation({
    tag,
    summary: `Crear ${noun}`,
    requestBody: body(ref('NamedEntityInput')),
    responses: {
      201: json(data({ item: ref(schemaName) }), 'Creado'),
      409: { $ref: '#/components/responses/Conflict' },
    },
  }),
});

const namedEntityStatus = (tag, noun, schemaName) => ({
  patch: operation({
    tag,
    summary: `Activar o desactivar ${noun}`,
    parameters: [idParameter],
    requestBody: body(ref('StatusInput')),
    responses: {
      200: json(data({ item: ref(schemaName) })),
      404: { $ref: '#/components/responses/NotFound' },
    },
  }),
});

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'StockFlow API',
    version: '1.0.0',
    description:
      'API del sistema de control de stock. La autenticación usa la cookie de sesión `stock.sid`; primero ejecute Login y Swagger conservará la cookie automáticamente.',
  },
  servers: [{ url: '/api', description: 'Servidor actual' }],
  tags: [
    ['Salud', 'Estado operativo público'],
    ['Autenticación', 'Inicio, consulta y cierre de sesión'],
    ['Usuarios', 'Administración de usuarios (solo ADMIN)'],
    ['Productos', 'Catálogo de productos'],
    ['Categorías', 'Catálogo de categorías'],
    ['Ubicaciones', 'Catálogo de ubicaciones'],
    ['Inventario', 'Movimientos de stock'],
    ['Dashboard', 'Resumen operativo'],
    ['Auditoría', 'Registro inmutable de acciones'],
    ['Sincronización', 'Cola offline, reintentos y conflictos'],
  ].map(([name, description]) => ({ name, description })),
  paths: {
    '/health/live': {
      get: {
        tags: ['Salud'],
        summary: 'Comprobar que el proceso y SQLite están vivos',
        security: [],
        responses: {
          200: json(
            data({ status: { type: 'string', const: 'alive' }, version: { type: 'string' } }),
          ),
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Salud'],
        summary: 'Comprobar disponibilidad de MongoDB',
        security: [],
        responses: {
          200: json(
            data({
              status: { type: 'string', const: 'ready' },
              mongodb: { type: 'string', const: 'online' },
            }),
          ),
          503: json(
            data({
              status: { type: 'string', const: 'not_ready' },
              mongodb: { type: 'string', const: 'offline' },
            }),
            'MongoDB no disponible',
          ),
        },
      },
    },
    '/health': {
      get: {
        tags: ['Salud'],
        summary: 'Consultar salud del servicio',
        security: [],
        responses: {
          200: json(
            data({
              status: { type: 'string', enum: ['healthy', 'degraded'] },
              api: { type: 'string', const: 'ok' },
              mongodb: { type: 'string', enum: ['online', 'offline'] },
              outbox: ref('OutboxCounts'),
              version: { type: 'string', example: '1.0.0' },
            }),
          ),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión',
        security: [],
        requestBody: body(ref('LoginInput')),
        responses: {
          200: json(data({ user: ref('SessionUser') })),
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          429: { $ref: '#/components/responses/RateLimited' },
        },
      },
    },
    '/auth/logout': {
      post: operation({
        tag: 'Autenticación',
        summary: 'Cerrar sesión',
        responses: { 204: { description: 'Sesión cerrada' } },
      }),
    },
    '/auth/me': {
      get: operation({
        tag: 'Autenticación',
        summary: 'Obtener la sesión actual',
        responses: { 200: json(data({ user: ref('SessionUser') })) },
      }),
    },
    '/users': {
      get: operation({
        tag: 'Usuarios',
        summary: 'Listar usuarios',
        parameters: paginationParameters,
        responses: {
          200: json(data({ items: { type: 'array', items: ref('User') }, pagination })),
        },
      }),
      post: operation({
        tag: 'Usuarios',
        summary: 'Crear usuario',
        requestBody: body(ref('CreateUserInput')),
        responses: {
          201: json(data({ user: ref('User') }), 'Creado'),
          409: { $ref: '#/components/responses/Conflict' },
        },
      }),
    },
    '/users/{id}/password': {
      patch: operation({
        tag: 'Usuarios',
        summary: 'Cambiar contraseña',
        parameters: [idParameter],
        requestBody: body(ref('PasswordInput')),
        responses: {
          200: json(data({ user: ref('User'), requiresLogin: { type: 'boolean' } })),
          404: { $ref: '#/components/responses/NotFound' },
        },
      }),
    },
    '/users/{id}/status': {
      patch: operation({
        tag: 'Usuarios',
        summary: 'Activar o desactivar usuario',
        parameters: [idParameter],
        requestBody: body(ref('StatusInput')),
        responses: {
          200: json(data({ user: ref('User') })),
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      }),
    },
    '/products': {
      get: operation({
        tag: 'Productos',
        summary: 'Listar y buscar productos',
        parameters: [
          ...paginationParameters,
          { name: 'active', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
        ],
        responses: {
          200: json(data({ items: { type: 'array', items: ref('Product') }, pagination })),
        },
      }),
      post: operation({
        tag: 'Productos',
        summary: 'Crear producto',
        requestBody: body(ref('ProductInput')),
        responses: {
          201: json(data({ product: ref('Product') }), 'Creado'),
          409: { $ref: '#/components/responses/Conflict' },
        },
      }),
    },
    '/products/lookup/{code}': {
      get: operation({
        tag: 'Productos',
        summary: 'Buscar producto por código interno o de barras',
        parameters: [
          { name: 'code', in: 'path', required: true, schema: { type: 'string', maxLength: 64 } },
        ],
        responses: {
          200: json(data({ product: ref('Product') })),
          404: { $ref: '#/components/responses/NotFound' },
        },
      }),
    },
    '/products/{id}': {
      get: operation({
        tag: 'Productos',
        summary: 'Obtener producto',
        parameters: [idParameter],
        responses: {
          200: json(data({ product: ref('Product') })),
          404: { $ref: '#/components/responses/NotFound' },
        },
      }),
      patch: operation({
        tag: 'Productos',
        summary: 'Actualizar producto',
        parameters: [idParameter],
        requestBody: body(ref('UpdateProductInput')),
        responses: {
          200: json(data({ product: ref('Product') })),
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      }),
    },
    '/products/{id}/status': {
      patch: operation({
        tag: 'Productos',
        summary: 'Activar o desactivar producto',
        parameters: [idParameter],
        requestBody: body(ref('StatusInput')),
        responses: {
          200: json(data({ product: ref('Product') })),
          404: { $ref: '#/components/responses/NotFound' },
        },
      }),
    },
    '/categories': namedEntityPaths('Categorías', 'categorías', 'Category'),
    '/categories/{id}/status': namedEntityStatus('Categorías', 'categoría', 'Category'),
    '/locations': namedEntityPaths('Ubicaciones', 'ubicaciones', 'Location'),
    '/locations/{id}/status': namedEntityStatus('Ubicaciones', 'ubicación', 'Location'),
    '/inventory/movements': {
      get: operation({
        tag: 'Inventario',
        summary: 'Listar movimientos',
        parameters: [
          ...paginationParameters,
          { name: 'type', in: 'query', schema: ref('MovementType') },
          { name: 'productId', in: 'query', schema: objectId },
          { name: 'userId', in: 'query', schema: objectId },
          { name: 'operationId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'reason', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'client', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: json(data({ items: { type: 'array', items: ref('Movement') }, pagination })),
        },
      }),
      post: operation({
        tag: 'Inventario',
        summary: 'Registrar movimiento de stock',
        requestBody: body(ref('MovementInput')),
        responses: {
          201: json(
            data({ status: { type: 'string', const: 'SYNCED' }, movement: ref('Movement') }),
            'Sincronizado',
          ),
          202: json(
            data({
              status: { type: 'string', enum: ['PENDING', 'CONFLICT'] },
              operation: ref('SyncOperation'),
            }),
            'Encolado',
          ),
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/Unprocessable' },
        },
      }),
    },
    '/dashboard': {
      get: operation({
        tag: 'Dashboard',
        summary: 'Obtener resumen operativo',
        responses: {
          200: json(
            data({
              outputsToday: { type: ['integer', 'null'] },
              inputsToday: { type: ['integer', 'null'] },
              outputsMonth: { type: ['integer', 'null'] },
              inputsMonth: { type: ['integer', 'null'] },
              lowStock: { type: ['integer', 'null'] },
              outOfStock: { type: ['integer', 'null'] },
              latest: { type: 'array', items: ref('Movement') },
              mongodb: { type: 'string', enum: ['online', 'offline'] },
              outbox: ref('OutboxCounts'),
            }),
          ),
        },
      }),
    },
    '/audit': {
      get: operation({
        tag: 'Auditoría',
        summary: 'Listar registros de auditoría',
        parameters: [
          ...paginationParameters,
          { name: 'action', in: 'query', schema: { type: 'string', maxLength: 80 } },
          { name: 'userId', in: 'query', schema: objectId },
        ],
        responses: {
          200: json(data({ items: { type: 'array', items: ref('AuditLog') }, pagination })),
        },
      }),
    },
    '/sync/operations': {
      get: operation({
        tag: 'Sincronización',
        summary: 'Listar operaciones de sincronización',
        parameters: [
          ...paginationParameters,
          { name: 'status', in: 'query', schema: ref('SyncStatus') },
        ],
        responses: {
          200: json(data({ items: { type: 'array', items: ref('SyncOperation') }, pagination })),
        },
      }),
    },
    '/sync/operations/{id}/retry': {
      post: operation({
        tag: 'Sincronización',
        summary: 'Reintentar operación fallida',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: json(data({ operation: ref('SyncOperation') })),
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
        },
      }),
    },
    '/sync/conflicts/{id}/resolve': {
      post: operation({
        tag: 'Sincronización',
        summary: 'Resolver conflicto',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: body(ref('ConflictResolutionInput')),
        responses: {
          200: json(
            data({
              resolution: { type: 'string', enum: ['REPLACED', 'DISMISSED'] },
              result: { oneOf: [ref('SyncResult'), { type: 'null' }] },
            }),
          ),
          404: { $ref: '#/components/responses/NotFound' },
          409: { $ref: '#/components/responses/Conflict' },
          422: { $ref: '#/components/responses/Unprocessable' },
        },
      }),
    },
  },
  components: {
    securitySchemes: {
      cookieSession: {
        type: 'apiKey',
        in: 'cookie',
        name: 'stock.sid',
        description: 'Cookie HTTP-only creada por POST /auth/login.',
      },
    },
    responses: {
      BadRequest: {
        description: 'Datos inválidos',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      Unauthorized: {
        description: 'Sesión requerida o credenciales inválidas',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      Forbidden: {
        description: 'Permiso insuficiente',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      NotFound: {
        description: 'Recurso no encontrado',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      Conflict: {
        description: 'Conflicto de estado o duplicado',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      Unprocessable: {
        description: 'Regla de negocio incumplida',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      RateLimited: {
        description: 'Límite de solicitudes excedido',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
      InternalError: {
        description: 'Error interno',
        content: { 'application/json': { schema: ref('ErrorResponse') } },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message', 'requestId'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: {},
              requestId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
      SessionUser: {
        type: 'object',
        required: ['id', 'name', 'email', 'role'],
        properties: {
          id: objectId,
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN'] },
        },
      },
      User: {
        type: 'object',
        required: ['_id', 'name', 'email', 'role', 'active'],
        properties: {
          _id: objectId,
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN'] },
          active: { type: 'boolean' },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      LoginInput: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', format: 'password', minLength: 8, maxLength: 200 },
        },
      },
      CreateUserInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', format: 'password', minLength: 10, maxLength: 200 },
          role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN'] },
        },
      },
      PasswordInput: {
        type: 'object',
        additionalProperties: false,
        required: ['password'],
        properties: {
          password: { type: 'string', format: 'password', minLength: 10, maxLength: 200 },
        },
      },
      StatusInput: {
        type: 'object',
        additionalProperties: false,
        required: ['active'],
        properties: { active: { type: 'boolean' } },
      },
      NamedEntityInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          code: {
            type: 'string',
            minLength: 1,
            maxLength: 40,
            pattern: '^[A-Z0-9_-]+$',
            example: 'CAM',
          },
        },
      },
      Category: { $ref: '#/components/schemas/NamedEntity' },
      Location: { $ref: '#/components/schemas/NamedEntity' },
      NamedEntity: {
        type: 'object',
        required: ['_id', 'name', 'code', 'active'],
        properties: {
          _id: objectId,
          name: { type: 'string' },
          code: { type: 'string' },
          active: { type: 'boolean' },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      ProductInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'categoryId', 'locationId'],
        properties: {
          internalCode: {
            type: 'string',
            minLength: 3,
            maxLength: 40,
            pattern: '^[A-Z0-9_-]+$',
            description:
              'Opcional; si se omite se genera correlativamente desde el prefijo de categoría.',
          },
          barcodes: {
            type: 'array',
            maxItems: 20,
            uniqueItems: true,
            items: { type: 'string', minLength: 3, maxLength: 64 },
          },
          name: { type: 'string', minLength: 2, maxLength: 160 },
          brand: { type: 'string', maxLength: 100 },
          model: { type: 'string', maxLength: 100 },
          categoryId: objectId,
          locationId: objectId,
          minimumStock: { type: 'integer', minimum: 0, default: 0 },
          serializable: { type: 'boolean', default: false },
        },
      },
      UpdateProductInput: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          barcodes: {
            type: 'array',
            maxItems: 20,
            uniqueItems: true,
            items: { type: 'string', minLength: 3, maxLength: 64 },
          },
          name: { type: 'string', minLength: 2, maxLength: 160 },
          brand: { type: 'string', maxLength: 100 },
          model: { type: 'string', maxLength: 100 },
          categoryId: objectId,
          locationId: objectId,
          minimumStock: { type: 'integer', minimum: 0 },
          serializable: { type: 'boolean' },
        },
      },
      Product: {
        type: 'object',
        required: ['_id', 'internalCode', 'name', 'stock', 'minimumStock', 'active'],
        properties: {
          _id: objectId,
          internalCode: { type: 'string' },
          barcodes: { type: 'array', items: { type: 'string' } },
          name: { type: 'string' },
          brand: { type: 'string' },
          model: { type: 'string' },
          categoryId: { oneOf: [objectId, ref('Category')] },
          locationId: { oneOf: [objectId, ref('Location')] },
          stock: { type: 'integer', minimum: 0 },
          minimumStock: { type: 'integer', minimum: 0 },
          serializable: { type: 'boolean' },
          active: { type: 'boolean' },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      MovementType: {
        type: 'string',
        enum: ['IN', 'OUT', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
      },
      MovementInput: {
        type: 'object',
        additionalProperties: false,
        required: ['operationId', 'productId', 'type', 'quantity', 'reason'],
        properties: {
          operationId: { type: 'string', format: 'uuid' },
          productId: objectId,
          type: ref('MovementType'),
          quantity: { type: 'integer', minimum: 1 },
          reason: {
            type: 'string',
            minLength: 2,
            maxLength: 240,
            description:
              'Para OUT: Instalación, Mantenimiento, Service, Préstamo, Uso interno u Otro.',
          },
          client: { type: 'string', maxLength: 160 },
          jobNumber: { type: 'string', maxLength: 80 },
          observation: { type: 'string', maxLength: 1000 },
          relatedMovementId: objectId,
          serialNumbers: {
            type: 'array',
            maxItems: 100,
            items: { type: 'string', minLength: 1, maxLength: 120 },
          },
          expectedStock: { type: 'integer', minimum: 0, description: 'Solo para ajustes.' },
        },
      },
      Movement: {
        type: 'object',
        required: [
          '_id',
          'operationId',
          'productId',
          'userId',
          'type',
          'quantity',
          'stockBefore',
          'stockAfter',
          'reason',
          'createdAt',
        ],
        properties: {
          _id: objectId,
          operationId: { type: 'string', format: 'uuid' },
          productId: { oneOf: [objectId, ref('Product')] },
          userId: { oneOf: [objectId, ref('User')] },
          type: ref('MovementType'),
          quantity: { type: 'integer' },
          stockBefore: { type: 'integer' },
          stockAfter: { type: 'integer' },
          reason: { type: 'string' },
          client: { type: 'string' },
          jobNumber: { type: 'string' },
          observation: { type: 'string' },
          relatedMovementId: objectId,
          serialNumbers: { type: 'array', items: { type: 'string' } },
          createdAt: dateTime,
        },
      },
      OutboxCounts: {
        type: 'object',
        required: ['pending', 'syncing', 'failed', 'conflicts', 'oldestUnresolvedAt'],
        properties: {
          pending: { type: 'integer' },
          syncing: { type: 'integer' },
          failed: { type: 'integer' },
          conflicts: { type: 'integer' },
          oldestUnresolvedAt: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      SyncStatus: { type: 'string', enum: ['PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT'] },
      SyncOperation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: ref('SyncStatus'),
          payload: { type: 'object', additionalProperties: true },
          attempts: { type: 'integer' },
          lastError: { type: ['string', 'null'] },
          createdAt: dateTime,
          updatedAt: dateTime,
        },
      },
      SyncResult: {
        type: 'object',
        properties: {
          status: ref('SyncStatus'),
          movement: ref('Movement'),
          operation: ref('SyncOperation'),
        },
      },
      ConflictResolutionInput: {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'reason'],
        properties: {
          action: { type: 'string', enum: ['REPLACED', 'DISMISSED'] },
          reason: { type: 'string', minLength: 3, maxLength: 500 },
          replacement: ref('MovementInput'),
        },
      },
      AuditLog: {
        type: 'object',
        required: ['_id', 'userId', 'action', 'entity', 'entityId', 'createdAt'],
        properties: {
          _id: objectId,
          userId: { oneOf: [objectId, ref('User')] },
          action: { type: 'string' },
          entity: { type: 'string' },
          entityId: objectId,
          changes: {},
          reason: { type: 'string' },
          requestId: { type: 'string' },
          operationId: { type: 'string' },
          createdAt: dateTime,
        },
      },
    },
  },
};
