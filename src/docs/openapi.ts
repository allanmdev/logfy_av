type Schema = Record<string, unknown>;

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });

const uuidParam = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
  example: '3f1c2a8e-6d4b-4c1f-9a7e-2b5d8c9e0f12',
});

const paginationParams = [
  {
    name: 'page',
    in: 'query',
    required: false,
    description: 'Página desejada (inicia em 1).',
    schema: { type: 'integer', minimum: 1, default: 1 },
  },
  {
    name: 'limit',
    in: 'query',
    required: false,
    description: 'Quantidade de itens por página (máximo 100).',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

const errorResponse = (description: string, code: string, message: string) => ({
  description,
  content: {
    'application/json': {
      schema: ref('Error'),
      example: {
        error: {
          code,
          message,
          request_id: '9b2f1d4e-8c3a-4f5b-a6d7-e8f9a0b1c2d3',
        },
      },
    },
  },
});

const errors = {
  401: errorResponse('Credencial ausente ou inválida.', 'UNAUTHORIZED', 'A valid API key is required.'),
  403: errorResponse('A API Key não possui o scope exigido.', 'FORBIDDEN', 'The API key does not have the required scopes.'),
  404: errorResponse('Recurso não encontrado na conta autenticada.', 'RESOURCE_NOT_FOUND', 'Resource not found.'),
  409: errorResponse('Conflito com uma regra de unicidade.', 'RESOURCE_ALREADY_EXISTS', 'The resource already exists.'),
  422: errorResponse('Dados inválidos ou regra de negócio violada.', 'VALIDATION_ERROR', 'The request contains invalid data.'),
};

const single = (schema: string, description: string, example?: unknown) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: ref(schema) } },
      ...(example ? { example: { data: example } } : {}),
    },
  },
});

const list = (schema: string, description: string) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: ref(schema) },
          pagination: ref('Pagination'),
        },
      },
    },
  },
});

const body = (schema: string, example: unknown) => ({
  required: true,
  content: { 'application/json': { schema: ref(schema), example } },
});

const noContent = { description: 'Operação concluída sem conteúdo de resposta.' };

const timestamps = {
  createdAt: { type: 'string', format: 'date-time', readOnly: true },
  updatedAt: { type: 'string', format: 'date-time', readOnly: true },
};

const uuid = { type: 'string', format: 'uuid', readOnly: true };

const vehicleExample = { name: 'Van 01', capacity: 100, active: true };
const routePlanExample = {
  name: 'Rota da manhã',
  depotLatitude: -26.3044,
  depotLongitude: -48.8487,
};
const deliveryExample = {
  reference: 'PEDIDO-001',
  latitude: -26.2951,
  longitude: -48.8458,
  demand: 10,
  serviceDurationSeconds: 300,
};

const routingSecurity = [{ ApiKeyAuth: [] }];
const adminSecurity = [{ AdminKeyAuth: [] }];

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Logfy API',
    version: '1.0.0',
    description:
      'API REST de roteirização de entregas. Empresas (accounts) cadastram veículos, planos de rota e entregas e solicitam a otimização da rota. Endpoints administrativos usam o header X-Admin-Key; endpoints de roteirização usam o header X-API-Key.',
  },
  servers: [{ url: '/v1', description: 'Versão 1 da API' }],
  tags: [
    { name: 'Health', description: 'Disponibilidade da aplicação' },
    { name: 'Accounts', description: 'Empresas clientes (administração)' },
    { name: 'API Keys', description: 'Credenciais de acesso das empresas (administração)' },
    { name: 'Vehicles', description: 'Frota de veículos da empresa' },
    { name: 'Route Plans', description: 'Planos de rota com depósito de saída' },
    { name: 'Deliveries', description: 'Entregas vinculadas a um plano de rota' },
    { name: 'Routing', description: 'Otimização dos planos de rota' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      AdminKeyAuth: { type: 'apiKey', in: 'header', name: 'X-Admin-Key' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object', nullable: true },
              request_id: { type: 'string' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 1 },
          totalPages: { type: 'integer', example: 1 },
        },
      },
      Account: {
        type: 'object',
        properties: {
          id: uuid,
          name: { type: 'string', example: 'Transportadora Joinville' },
          slug: { type: 'string', example: 'transportadora-joinville' },
          status: { type: 'string', enum: ['active', 'suspended', 'inactive'] },
          ...timestamps,
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      AccountInput: {
        type: 'object',
        required: ['name', 'slug'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 150 },
          slug: { type: 'string', minLength: 2, maxLength: 100, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        },
      },
      AccountReplaceInput: {
        type: 'object',
        required: ['name', 'slug', 'status'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 150 },
          slug: { type: 'string', minLength: 2, maxLength: 100 },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] },
        },
      },
      AccountPatchInput: {
        type: 'object',
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 150 },
          slug: { type: 'string', minLength: 2, maxLength: 100 },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'] },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: uuid,
          accountId: uuid,
          name: { type: 'string' },
          prefix: { type: 'string', example: 'lgfy_test_' },
          scopes: { type: 'array', items: { type: 'string' } },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          revokedAt: { type: 'string', format: 'date-time', nullable: true },
          ...timestamps,
        },
      },
      CreatedApiKey: {
        allOf: [
          ref('ApiKey'),
          {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Chave completa, exibida apenas na criação.' },
            },
          },
        ],
      },
      ApiKeyInput: {
        type: 'object',
        required: ['name', 'scopes'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 150 },
          scopes: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', enum: ['routing:read', 'routing:write'] },
          },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      Vehicle: {
        type: 'object',
        properties: {
          id: uuid,
          accountId: uuid,
          name: { type: 'string', example: 'Van 01' },
          capacity: { type: 'integer', example: 100 },
          active: { type: 'boolean', example: true },
          ...timestamps,
        },
      },
      VehicleInput: {
        type: 'object',
        required: ['name', 'capacity'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 150, description: 'Único por empresa (sem diferenciar maiúsculas).' },
          capacity: { type: 'integer', minimum: 1, description: 'Capacidade de carga na unidade definida pela empresa.' },
          active: { type: 'boolean', default: true },
        },
      },
      VehiclePatchInput: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 150 },
          capacity: { type: 'integer', minimum: 1 },
          active: { type: 'boolean' },
        },
      },
      RoutePlan: {
        type: 'object',
        properties: {
          id: uuid,
          accountId: uuid,
          name: { type: 'string', example: 'Rota da manhã' },
          depotLatitude: { type: 'number', example: -26.3044 },
          depotLongitude: { type: 'number', example: -48.8487 },
          status: { type: 'string', enum: ['draft', 'optimized'] },
          version: { type: 'integer', example: 0 },
          ...timestamps,
        },
      },
      RoutePlanInput: {
        type: 'object',
        required: ['name', 'depotLatitude', 'depotLongitude'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 150 },
          depotLatitude: { type: 'number', minimum: -90, maximum: 90 },
          depotLongitude: { type: 'number', minimum: -180, maximum: 180 },
        },
      },
      RoutePlanPatchInput: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 150 },
          depotLatitude: { type: 'number', minimum: -90, maximum: 90 },
          depotLongitude: { type: 'number', minimum: -180, maximum: 180 },
        },
      },
      Delivery: {
        type: 'object',
        properties: {
          id: uuid,
          accountId: uuid,
          routePlanId: uuid,
          reference: { type: 'string', example: 'PEDIDO-001' },
          latitude: { type: 'number', example: -26.2951 },
          longitude: { type: 'number', example: -48.8458 },
          demand: { type: 'integer', example: 10 },
          serviceDurationSeconds: { type: 'integer', example: 300 },
          ...timestamps,
        },
      },
      DeliveryInput: {
        type: 'object',
        required: ['reference', 'latitude', 'longitude', 'demand'],
        additionalProperties: false,
        properties: {
          reference: { type: 'string', minLength: 1, maxLength: 150, description: 'Única dentro do plano.' },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          demand: { type: 'integer', minimum: 1 },
          serviceDurationSeconds: { type: 'integer', minimum: 0, maximum: 86400, default: 0 },
        },
      },
      DeliveryPatchInput: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          reference: { type: 'string', minLength: 1, maxLength: 150 },
          latitude: { type: 'number', minimum: -90, maximum: 90 },
          longitude: { type: 'number', minimum: -180, maximum: 180 },
          demand: { type: 'integer', minimum: 1 },
          serviceDurationSeconds: { type: 'integer', minimum: 0, maximum: 86400 },
        },
      },
      OptimizeInput: {
        type: 'object',
        required: ['vehicleIds'],
        additionalProperties: false,
        properties: {
          vehicleIds: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
          fuelConsumptionKmPerLiter: { type: 'number', minimum: 0, exclusiveMinimum: true, maximum: 1000, default: 10 },
        },
      },
      RouteOptimization: {
        type: 'object',
        properties: {
          id: uuid,
          accountId: uuid,
          routePlanId: uuid,
          createdAt: { type: 'string', format: 'date-time' },
          result: {
            type: 'object',
            properties: {
              algorithm: { type: 'string' },
              matrixProvider: { type: 'string' },
              routes: { type: 'array', items: { type: 'object' } },
              totalDistanceMeters: { type: 'number' },
              totalDurationSeconds: { type: 'number' },
              summary: { type: 'object' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica se a API está no ar',
        responses: {
          200: {
            description: 'API disponível.',
            content: {
              'application/json': {
                example: { data: { service: 'logfy-api', status: 'ok', timestamp: '2026-11-24T12:00:00.000Z' } },
              },
            },
          },
        },
      },
    },
    '/accounts': {
      post: {
        tags: ['Accounts'],
        summary: 'Cadastra uma empresa',
        security: adminSecurity,
        requestBody: body('AccountInput', { name: 'Transportadora Joinville', slug: 'transportadora-joinville' }),
        responses: { 201: single('Account', 'Empresa cadastrada.'), 401: errors[401], 409: errors[409], 422: errors[422] },
      },
      get: {
        tags: ['Accounts'],
        summary: 'Lista as empresas',
        security: adminSecurity,
        parameters: [
          ...paginationParams,
          { name: 'deleted', in: 'query', required: false, description: 'Filtra empresas excluídas.', schema: { type: 'string', enum: ['all', 'true', 'false'], default: 'all' } },
        ],
        responses: { 200: list('Account', 'Lista paginada de empresas.'), 401: errors[401], 422: errors[422] },
      },
    },
    '/accounts/{id}': {
      parameters: [uuidParam('id', 'Identificador da empresa.')],
      get: {
        tags: ['Accounts'],
        summary: 'Consulta uma empresa',
        security: adminSecurity,
        responses: { 200: single('Account', 'Empresa encontrada.'), 401: errors[401], 404: errors[404], 422: errors[422] },
      },
      put: {
        tags: ['Accounts'],
        summary: 'Atualiza todos os dados de uma empresa',
        security: adminSecurity,
        requestBody: body('AccountReplaceInput', { name: 'Transportadora Joinville', slug: 'transportadora-joinville', status: 'ACTIVE' }),
        responses: { 200: single('Account', 'Empresa atualizada.'), 401: errors[401], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      patch: {
        tags: ['Accounts'],
        summary: 'Atualiza parcialmente uma empresa',
        security: adminSecurity,
        requestBody: body('AccountPatchInput', { status: 'SUSPENDED' }),
        responses: { 200: single('Account', 'Empresa atualizada.'), 401: errors[401], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      delete: {
        tags: ['Accounts'],
        summary: 'Exclui logicamente uma empresa',
        security: adminSecurity,
        responses: { 204: noContent, 401: errors[401], 404: errors[404], 422: errors[422] },
      },
    },
    '/accounts/{accountId}/api-keys': {
      parameters: [uuidParam('accountId', 'Identificador da empresa.')],
      post: {
        tags: ['API Keys'],
        summary: 'Emite uma API Key para a empresa',
        security: adminSecurity,
        requestBody: body('ApiKeyInput', { name: 'Integração ERP', scopes: ['routing:read', 'routing:write'] }),
        responses: { 201: single('CreatedApiKey', 'Chave emitida. O valor completo só é exibido nesta resposta.'), 401: errors[401], 404: errors[404], 422: errors[422] },
      },
      get: {
        tags: ['API Keys'],
        summary: 'Lista as API Keys da empresa',
        security: adminSecurity,
        responses: {
          200: { description: 'Chaves da empresa.', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: ref('ApiKey') } } } } } },
          401: errors[401],
          404: errors[404],
        },
      },
    },
    '/accounts/{accountId}/api-keys/{apiKeyId}': {
      parameters: [uuidParam('accountId', 'Identificador da empresa.'), uuidParam('apiKeyId', 'Identificador da chave.')],
      delete: {
        tags: ['API Keys'],
        summary: 'Revoga uma API Key',
        security: adminSecurity,
        responses: { 204: noContent, 401: errors[401], 404: errors[404] },
      },
    },
    '/vehicles': {
      post: {
        tags: ['Vehicles'],
        summary: 'Cadastra um veículo',
        description: 'Requer scope routing:write. O nome do veículo deve ser único dentro da empresa.',
        security: routingSecurity,
        requestBody: body('VehicleInput', vehicleExample),
        responses: { 201: single('Vehicle', 'Veículo cadastrado.'), 401: errors[401], 403: errors[403], 409: errorResponse('Nome já utilizado na empresa.', 'VEHICLE_NAME_ALREADY_EXISTS', 'Já existe um veículo com este nome nesta conta.'), 422: errors[422] },
      },
      get: {
        tags: ['Vehicles'],
        summary: 'Lista os veículos da empresa',
        security: routingSecurity,
        parameters: paginationParams,
        responses: { 200: list('Vehicle', 'Lista paginada de veículos.'), 401: errors[401], 403: errors[403], 422: errors[422] },
      },
    },
    '/vehicles/{id}': {
      parameters: [uuidParam('id', 'Identificador do veículo.')],
      get: {
        tags: ['Vehicles'],
        summary: 'Consulta um veículo',
        security: routingSecurity,
        responses: { 200: single('Vehicle', 'Veículo encontrado.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
      put: {
        tags: ['Vehicles'],
        summary: 'Atualiza todos os dados de um veículo',
        security: routingSecurity,
        requestBody: body('VehicleInput', { name: 'Van 01', capacity: 120, active: true }),
        responses: { 200: single('Vehicle', 'Veículo atualizado.'), 401: errors[401], 403: errors[403], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      patch: {
        tags: ['Vehicles'],
        summary: 'Atualiza parcialmente um veículo',
        security: routingSecurity,
        requestBody: body('VehiclePatchInput', { active: false }),
        responses: { 200: single('Vehicle', 'Veículo atualizado.'), 401: errors[401], 403: errors[403], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      delete: {
        tags: ['Vehicles'],
        summary: 'Exclui um veículo',
        security: routingSecurity,
        responses: { 204: noContent, 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
    },
    '/route-plans': {
      post: {
        tags: ['Route Plans'],
        summary: 'Cadastra um plano de rota',
        description: 'O depósito deve possuir coordenadas válidas e diferentes de (0, 0).',
        security: routingSecurity,
        requestBody: body('RoutePlanInput', routePlanExample),
        responses: { 201: single('RoutePlan', 'Plano cadastrado.'), 401: errors[401], 403: errors[403], 422: errors[422] },
      },
      get: {
        tags: ['Route Plans'],
        summary: 'Lista os planos de rota da empresa',
        security: routingSecurity,
        parameters: paginationParams,
        responses: { 200: list('RoutePlan', 'Lista paginada de planos.'), 401: errors[401], 403: errors[403], 422: errors[422] },
      },
    },
    '/route-plans/{id}': {
      parameters: [uuidParam('id', 'Identificador do plano de rota.')],
      get: {
        tags: ['Route Plans'],
        summary: 'Consulta um plano de rota',
        security: routingSecurity,
        responses: { 200: single('RoutePlan', 'Plano encontrado.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
      put: {
        tags: ['Route Plans'],
        summary: 'Atualiza todos os dados de um plano',
        description: 'Qualquer alteração volta o plano para draft e descarta a otimização anterior.',
        security: routingSecurity,
        requestBody: body('RoutePlanInput', { ...routePlanExample, name: 'Rota da tarde' }),
        responses: { 200: single('RoutePlan', 'Plano atualizado.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
      patch: {
        tags: ['Route Plans'],
        summary: 'Atualiza parcialmente um plano',
        security: routingSecurity,
        requestBody: body('RoutePlanPatchInput', { name: 'Rota da tarde' }),
        responses: { 200: single('RoutePlan', 'Plano atualizado.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
      delete: {
        tags: ['Route Plans'],
        summary: 'Exclui um plano com suas entregas e otimização',
        security: routingSecurity,
        responses: { 204: noContent, 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
    },
    '/route-plans/{routePlanId}/deliveries': {
      parameters: [uuidParam('routePlanId', 'Identificador do plano de rota.')],
      post: {
        tags: ['Deliveries'],
        summary: 'Adiciona uma entrega ao plano',
        description: 'A referência deve ser única no plano, a entrega não pode coincidir com o depósito e o plano respeita o limite ROUTING_MAX_DELIVERIES.',
        security: routingSecurity,
        requestBody: body('DeliveryInput', deliveryExample),
        responses: { 201: single('Delivery', 'Entrega cadastrada.'), 401: errors[401], 403: errors[403], 404: errors[404], 409: errorResponse('Referência já utilizada no plano.', 'DELIVERY_REFERENCE_ALREADY_EXISTS', 'Já existe uma entrega com esta referência no plano.'), 422: errorResponse('Dados inválidos, entrega no depósito ou limite atingido.', 'DELIVERY_AT_DEPOT', 'A entrega não pode estar na mesma coordenada do depósito.') },
      },
      get: {
        tags: ['Deliveries'],
        summary: 'Lista as entregas do plano',
        security: routingSecurity,
        parameters: paginationParams,
        responses: { 200: list('Delivery', 'Lista paginada de entregas.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
    },
    '/route-plans/{routePlanId}/deliveries/{id}': {
      parameters: [uuidParam('routePlanId', 'Identificador do plano de rota.'), uuidParam('id', 'Identificador da entrega.')],
      get: {
        tags: ['Deliveries'],
        summary: 'Consulta uma entrega',
        security: routingSecurity,
        responses: { 200: single('Delivery', 'Entrega encontrada.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
      put: {
        tags: ['Deliveries'],
        summary: 'Atualiza todos os dados de uma entrega',
        security: routingSecurity,
        requestBody: body('DeliveryInput', { ...deliveryExample, demand: 15 }),
        responses: { 200: single('Delivery', 'Entrega atualizada.'), 401: errors[401], 403: errors[403], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      patch: {
        tags: ['Deliveries'],
        summary: 'Atualiza parcialmente uma entrega',
        security: routingSecurity,
        requestBody: body('DeliveryPatchInput', { demand: 15 }),
        responses: { 200: single('Delivery', 'Entrega atualizada.'), 401: errors[401], 403: errors[403], 404: errors[404], 409: errors[409], 422: errors[422] },
      },
      delete: {
        tags: ['Deliveries'],
        summary: 'Exclui uma entrega',
        security: routingSecurity,
        responses: { 204: noContent, 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
    },
    '/route-plans/{id}/optimize': {
      parameters: [uuidParam('id', 'Identificador do plano de rota.')],
      post: {
        tags: ['Routing'],
        summary: 'Calcula e salva a rota otimizada do plano',
        description: 'Exige entregas cadastradas e veículos ativos com capacidade suficiente. Usa a Google Routes API.',
        security: routingSecurity,
        requestBody: body('OptimizeInput', { vehicleIds: ['3f1c2a8e-6d4b-4c1f-9a7e-2b5d8c9e0f12'], fuelConsumptionKmPerLiter: 10 }),
        responses: {
          200: single('RouteOptimization', 'Otimização calculada.'),
          401: errors[401],
          403: errors[403],
          404: errors[404],
          409: errorResponse('O plano mudou durante o cálculo.', 'CONCURRENT_MODIFICATION', 'The plan or selected vehicles changed. Retry optimization.'),
          422: errorResponse('Plano vazio ou capacidade insuficiente.', 'INSUFFICIENT_CAPACITY', 'The selected vehicles cannot carry these deliveries.'),
          503: errorResponse('Google Maps não configurado.', 'MAPS_NOT_CONFIGURED', 'The distance matrix provider is not configured.'),
        },
      },
    },
    '/route-plans/{id}/optimization': {
      parameters: [uuidParam('id', 'Identificador do plano de rota.')],
      get: {
        tags: ['Routing'],
        summary: 'Consulta a última otimização válida do plano',
        security: routingSecurity,
        responses: { 200: single('RouteOptimization', 'Otimização encontrada.'), 401: errors[401], 403: errors[403], 404: errors[404], 422: errors[422] },
      },
    },
  },
} satisfies Schema;
