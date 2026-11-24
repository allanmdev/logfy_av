# Logfy API

API REST de **roteirização de entregas** desenvolvida em Node.js, TypeScript, Express e PostgreSQL.

## 1. Nome e descrição do projeto

**Domínio:** logística de última milha (entregas urbanas).

**Problema:** transportadoras e empresas com frota própria costumam montar as rotas do dia manualmente, na ordem em que os pedidos chegam. Isso gera trajetos mais longos, mais tempo de motorista e mais combustível.

**Objetivo da API:** permitir que cada empresa cadastre sua **frota de veículos**, seus **planos de rota** (com o depósito de saída) e as **entregas** de cada plano, e então solicite a **otimização** da rota, que distribui as entregas entre os veículos respeitando a capacidade e compara distância, tempo e combustível com a rota original.

A API é multiempresa: cada empresa (`account`) acessa somente os próprios dados por meio de uma API Key.

## 2. Integrantes da equipe

| Nome completo |
| --- |
| Allan Camargo |

## 3. Tecnologias utilizadas

| Tecnologia | Uso |
| --- | --- |
| Node.js 22 | Ambiente de execução |
| TypeScript | Tipagem estática |
| Express 5 | Servidor HTTP e rotas |
| PostgreSQL 16 | Banco de dados relacional |
| Prisma ORM | Acesso ao banco, migrations e geração do cliente |
| Zod | Validação dos dados recebidos |
| Redis | Rate limit distribuído |
| Vitest | Testes unitários, de integração e cobertura (`@vitest/coverage-v8`) |
| Supertest | Requisições HTTP nos testes de integração |
| Swagger UI / OpenAPI 3 | Documentação interativa (`swagger-ui-express`) |
| Helmet, CORS, Pino | Segurança HTTP e logs estruturados |
| Docker Compose | PostgreSQL e Redis locais |
| Git e GitHub Actions | Versionamento e integração contínua |

> A persistência usa PostgreSQL. O projeto funciona com qualquer instância PostgreSQL, inclusive a do Supabase: basta apontar `DATABASE_URL` para ela.

## 4. Entidades e relacionamentos

As três entidades principais do domínio possuem CRUD completo:

| Entidade | Tabela | Principais atributos |
| --- | --- | --- |
| **Vehicle** (veículo) | `vehicles` | `id` (UUID), `accountId`, `name`, `capacity`, `active`, `createdAt`, `updatedAt` |
| **RoutePlan** (plano de rota) | `route_plans` | `id` (UUID), `accountId`, `name`, `depotLatitude`, `depotLongitude`, `status` (`draft`/`optimized`), `version`, `createdAt`, `updatedAt` |
| **Delivery** (entrega) | `deliveries` | `id` (UUID), `accountId`, `routePlanId`, `reference`, `latitude`, `longitude`, `demand`, `serviceDurationSeconds`, `createdAt`, `updatedAt` |

Entidades de apoio:

| Entidade | Tabela | Papel |
| --- | --- | --- |
| **Account** (empresa) | `accounts` | Dona de todos os dados. CRUD administrativo com exclusão lógica (`deletedAt`). |
| **ApiKey** | `api_keys` | Credencial da empresa. Armazena apenas o hash SHA-256 da chave. |
| **RouteOptimization** | `route_optimizations` | Último resultado de otimização de um plano (JSONB). |

Relacionamentos:

```
Account 1 ──── N Vehicle
Account 1 ──── N RoutePlan 1 ──── N Delivery
                     RoutePlan 1 ──── 0..1 RouteOptimization
Account 1 ──── N ApiKey
```

- `vehicles.accountId` → `accounts.id` (FK, `ON DELETE CASCADE`)
- `route_plans.accountId` → `accounts.id` (FK, `ON DELETE CASCADE`)
- `deliveries.(routePlanId, accountId)` → `route_plans.(id, accountId)` (FK composta, `ON DELETE CASCADE`): garante no banco que a entrega pertence a um plano da mesma empresa
- `route_optimizations.(routePlanId, accountId)` → `route_plans.(id, accountId)` (FK composta, `ON DELETE CASCADE`)
- `api_keys.accountId` → `accounts.id` (FK, `ON DELETE CASCADE`)

## 5. Regras de negócio

As regras ficam na camada de serviços (`application/use-cases`) e em objetos de domínio, e não nos controllers ou repositórios.

**Veículos**
1. O nome do veículo é único dentro da empresa, sem diferenciar maiúsculas de minúsculas (`409 VEHICLE_NAME_ALREADY_EXISTS`).
2. A capacidade deve ser um número inteiro positivo (`422`).
3. Veículos novos são criados como ativos (`active = true`); apenas veículos ativos podem ser usados na otimização.

**Planos de rota**
4. O depósito precisa de coordenadas válidas (latitude entre -90 e 90, longitude entre -180 e 180) e não pode ser `(0, 0)`, que não representa um endereço real (`422 INVALID_COORDINATE`). A validação é feita pelo objeto de valor `Coordinate`.
5. Todo plano nasce como `draft`. Qualquer alteração no plano ou nas suas entregas volta o plano para `draft`, incrementa `version` e descarta a otimização anterior, na mesma transação.
6. Excluir um plano exclui suas entregas e sua otimização em cascata.

**Entregas**
7. A entrega só pode ser criada em um plano existente da própria empresa (`404 ROUTE_PLAN_NOT_FOUND`).
8. A referência (`reference`) é única dentro do plano (`409 DELIVERY_REFERENCE_ALREADY_EXISTS`).
9. A entrega não pode estar na mesma coordenada do depósito do plano (`422 DELIVERY_AT_DEPOT`).
10. Um plano aceita no máximo `ROUTING_MAX_DELIVERIES` entregas (padrão 100) (`422 ROUTE_PLAN_DELIVERY_LIMIT_REACHED`).
11. A demanda deve ser inteira e positiva; o tempo de atendimento vai de 0 a 86400 segundos (padrão 0).

**Otimização**
12. Só é possível otimizar um plano com entregas (`422 EMPTY_ROUTE_PLAN`), usando de 1 a 100 veículos ativos e distintos.
13. A soma das capacidades deve atender à soma das demandas e nenhuma entrega pode ser maior que o maior veículo (`422 INSUFFICIENT_CAPACITY`).
14. Se o plano ou os veículos mudarem durante o cálculo, o resultado não é salvo (`409 CONCURRENT_MODIFICATION`).

**Segurança e isolamento**
15. Cada empresa só enxerga os próprios dados: identificadores de outra empresa retornam `404`.
16. Leituras exigem o scope `routing:read`; criação, alteração, exclusão e otimização exigem `routing:write` (`403`).
17. Chaves revogadas ou expiradas e empresas suspensas, inativas ou excluídas recebem `401`.

## 6. Estrutura do projeto

O projeto é organizado por módulos de domínio. Cada módulo segue a mesma divisão em camadas:

```
src/
├── app.ts                         # Configuração do Express (middlewares, Swagger, rotas)
├── server.ts                      # Inicialização do servidor e encerramento gracioso
├── config/
│   └── env.ts                     # Leitura e validação das variáveis de ambiente
├── docs/
│   └── openapi.ts                 # Especificação OpenAPI usada pelo Swagger
├── modules/
│   ├── vehicles/
│   │   ├── domain/
│   │   │   ├── entities/          # Models: interfaces das entidades
│   │   │   └── repositories/      # Contratos (interfaces) dos repositórios
│   │   ├── application/
│   │   │   ├── dto/               # Dados de entrada dos serviços
│   │   │   └── use-cases/         # Services: regras de negócio
│   │   ├── infrastructure/
│   │   │   └── repositories/      # Repositories: implementação com Prisma
│   │   └── presentation/http/
│   │       ├── *.controller.ts    # Controllers: HTTP → serviço → resposta JSON
│   │       ├── *.routes.ts        # Routes: métodos, caminhos e middlewares
│   │       └── *.schemas.ts       # Validação Zod do corpo, parâmetros e query
│   ├── route-plans/               # Mesma estrutura
│   ├── deliveries/                # Mesma estrutura
│   ├── accounts/                  # Mesma estrutura
│   ├── api-keys/                  # Mesma estrutura
│   └── routing/                   # Otimização: portas, algoritmo e provedor Google
└── shared/
    ├── auth/                      # Contexto de autenticação e scopes
    ├── container/                 # Injeção de dependências (composição das classes)
    ├── database/                  # Cliente Prisma e tradução de erros do banco
    ├── domain/                    # Objetos de domínio compartilhados (Coordinate, paginação)
    ├── errors/                    # AppError (erro de aplicação com código HTTP)
    ├── http/                      # Middlewares (validação, erros, auth, rate limit)
    ├── logger/                    # Logger Pino
    ├── redis/                     # Cliente Redis e store do rate limit
    └── security/                  # Contratos de segurança
prisma/
├── schema.prisma                  # Modelo do banco
└── migrations/                    # Histórico de migrations
database/
└── schema.sql                     # Script SQL completo da estrutura do banco
tests/
├── unit/                          # Testes unitários (sem banco)
│   └── services/                  # Regras de negócio dos serviços com mocks
├── integration/                   # Testes de integração (Supertest + PostgreSQL)
├── support/                       # Fábricas de dados, mocks e utilitários de teste
└── run-integration.ts             # Cria banco temporário, aplica migrations e roda os testes
```

**Correspondência com as camadas da disciplina**

| Camada | Onde está no projeto |
| --- | --- |
| Models | `modules/*/domain/entities` e `shared/domain` |
| Controllers | `modules/*/presentation/http/*.controller.ts` |
| Services | `modules/*/application/use-cases` (uma classe por operação) |
| Repositories | contrato em `domain/repositories`, implementação em `infrastructure/repositories` |
| Routes | `modules/*/presentation/http/*.routes.ts` e `shared/http/routes.ts` |

**Orientação a Objetos**

- Cada serviço, repositório e controller é uma classe com responsabilidade única.
- As dependências são recebidas pelo construtor (injeção de dependência) e declaradas como `private readonly` (encapsulamento). Os serviços dependem de interfaces, não do Prisma, o que permite testá-los com mocks.
- `Coordinate` é um objeto de valor com construtor privado: só é criado por `Coordinate.create`, que valida a coordenada, e expõe o comportamento `equals`.
- `VehicleNamePolicy` e `DeliveryPolicy` agrupam regras reutilizadas pelos serviços de criação e atualização.
- `AppError` estende `Error` (herança) e carrega código e status HTTP.
- Os repositórios Prisma implementam as interfaces do domínio (`implements`), o que permite trocar a persistência sem alterar os serviços.

## 7. Configuração e execução

Pré-requisitos: Node.js 22+, npm e Docker (ou um PostgreSQL 13+ e um Redis próprios).

```sh
git clone <url-do-repositorio> logfy_av
cd logfy_av
npm install
cp .env.example .env
docker compose up -d --wait
npx prisma generate
npm run db:migrate
npm run dev
```

1. Edite o `.env` e defina `ADMIN_API_KEY` com um valor aleatório de pelo menos 32 caracteres (por exemplo, `openssl rand -hex 32`).
2. `docker compose up -d --wait` sobe PostgreSQL e Redis locais com os mesmos valores do `.env.example`.
3. `npm run db:migrate` aplica as migrations em `prisma/migrations`.
4. A API inicia em `http://localhost:3000`. A documentação fica em `http://localhost:3000/api-docs`.

Para produção:

```sh
npm run build
npm start
```

### Primeiro acesso

Os endpoints de veículos, planos e entregas exigem uma API Key. Crie uma empresa e uma chave com a credencial administrativa:

```sh
curl -X POST http://localhost:3000/v1/accounts \
  -H "Content-Type: application/json" -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"name":"Transportadora Joinville","slug":"transportadora-joinville"}'

curl -X POST http://localhost:3000/v1/accounts/<ACCOUNT_ID>/api-keys \
  -H "Content-Type: application/json" -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"name":"Integração","scopes":["routing:read","routing:write"]}'
```

Use o campo `data.key` da resposta no header `X-API-Key`. A chave completa só aparece nessa resposta.

## 8. Variáveis de ambiente

O arquivo [.env.example](.env.example) traz todas as variáveis com valores de exemplo. O `.env` real está no `.gitignore` e não deve ser versionado.

| Variável | Obrigatória | Padrão | Descrição |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sim | – | URL de conexão do PostgreSQL |
| `ADMIN_API_KEY` | Para administração | – | Credencial dos endpoints `/v1/accounts` (mínimo 32 caracteres) |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `PORT` | Não | `3000` | Porta HTTP |
| `LOG_LEVEL` | Não | `info` | Nível de log do Pino |
| `REDIS_URL` | Não | `redis://127.0.0.1:6379` | Redis usado pelo rate limit |
| `RATE_LIMIT_MAX` | Não | `120` | Requisições por IP na janela |
| `RATE_LIMIT_WINDOW_MS` | Não | `60000` | Duração da janela do rate limit |
| `CORS_ORIGINS` | Não | vazio | Origens permitidas, separadas por vírgula |
| `TRUST_PROXY` | Não | vazio | Proxies confiáveis, separados por vírgula |
| `GOOGLE_MAPS_API_KEY` | Para otimizar | – | Chave da Google Routes API. Sem ela, a otimização retorna `503`; os cadastros funcionam normalmente |
| `GOOGLE_MAPS_TIMEOUT_MS` | Não | `10000` | Timeout das chamadas ao Google |
| `ROUTING_MAX_DELIVERIES` | Não | `100` | Máximo de entregas por plano (1 a 500) |

## 9. Banco de dados

Todas as tabelas usam **UUID** como chave primária, gerado pelo PostgreSQL (`gen_random_uuid()`).

A estrutura pode ser reproduzida de duas formas:

- **Migrations (recomendado):** `npm run db:migrate`
- **Script SQL:** execute [database/schema.sql](database/schema.sql) em um banco vazio, por exemplo `psql "$DATABASE_URL" -f database/schema.sql`

### Tabelas

**accounts**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK, default `gen_random_uuid()` |
| name | TEXT | NOT NULL |
| slug | TEXT | NOT NULL, UNIQUE |
| status | AccountStatus (`ACTIVE`, `SUSPENDED`, `INACTIVE`) | NOT NULL, default `ACTIVE` |
| createdAt / updatedAt | TIMESTAMP(3) | NOT NULL |
| deletedAt | TIMESTAMP(3) | NULL (exclusão lógica) |

**vehicles**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| accountId | UUID | NOT NULL, FK → accounts.id (CASCADE) |
| name | TEXT | NOT NULL |
| capacity | INTEGER | NOT NULL |
| active | BOOLEAN | NOT NULL, default `true` |
| createdAt / updatedAt | TIMESTAMP(3) | NOT NULL |

Índice: (`accountId`, `active`).

**route_plans**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| accountId | UUID | NOT NULL, FK → accounts.id (CASCADE) |
| name | TEXT | NOT NULL |
| depotLatitude / depotLongitude | DOUBLE PRECISION | NOT NULL |
| status | RoutePlanStatus (`DRAFT`, `OPTIMIZED`) | NOT NULL, default `DRAFT` |
| version | INTEGER | NOT NULL, default 0 |
| createdAt / updatedAt | TIMESTAMP(3) | NOT NULL |

Índices: UNIQUE (`id`, `accountId`), (`accountId`, `createdAt`).

**deliveries**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| accountId | UUID | NOT NULL |
| routePlanId | UUID | NOT NULL; (`routePlanId`, `accountId`) FK → route_plans.(id, accountId) (CASCADE) |
| reference | TEXT | NOT NULL; UNIQUE (`routePlanId`, `reference`) |
| latitude / longitude | DOUBLE PRECISION | NOT NULL |
| demand | INTEGER | NOT NULL |
| serviceDurationSeconds | INTEGER | NOT NULL, default 0 |
| createdAt / updatedAt | TIMESTAMP(3) | NOT NULL |

**api_keys**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| accountId | UUID | NOT NULL, FK → accounts.id (CASCADE) |
| name, prefix | TEXT | NOT NULL |
| keyHash | TEXT | NOT NULL, UNIQUE (hash SHA-256) |
| scopes | TEXT[] | |
| lastUsedAt, expiresAt, revokedAt | TIMESTAMP(3) | NULL |
| createdAt / updatedAt | TIMESTAMP(3) | NOT NULL |

**route_optimizations**

| Coluna | Tipo | Restrições |
| --- | --- | --- |
| id | UUID | PK |
| accountId | UUID | NOT NULL |
| routePlanId | UUID | NOT NULL, UNIQUE; (`routePlanId`, `accountId`) FK → route_plans.(id, accountId) (CASCADE) |
| result | JSONB | NOT NULL |
| createdAt | TIMESTAMP(3) | NOT NULL |

> A migration `use_uuid_identifiers` converteu os identificadores antigos (CUID em TEXT) para UUID mantendo os dados e os relacionamentos existentes.

## 10. Endpoints da API

Todos os caminhos começam com `/v1`. Corpo e respostas usam JSON. Sucesso: `{ "data": ... }`. Listagens: `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }` com os parâmetros `page` (padrão 1) e `limit` (padrão 20, máximo 100). Erro: `{ "error": { "code", "message", "details", "request_id" } }`.

`PUT` substitui todos os campos do recurso (corpo completo); `PATCH` altera apenas os campos enviados.

### Veículos (header `X-API-Key`)

| Método | Endpoint | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/vehicles` | Lista os veículos da empresa | 200 |
| GET | `/vehicles/:id` | Consulta um veículo | 200 |
| POST | `/vehicles` | Cadastra um veículo | 201 |
| PUT | `/vehicles/:id` | Atualiza todos os dados de um veículo | 200 |
| PATCH | `/vehicles/:id` | Atualiza parte dos dados de um veículo | 200 |
| DELETE | `/vehicles/:id` | Remove um veículo | 204 |

### Planos de rota (header `X-API-Key`)

| Método | Endpoint | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/route-plans` | Lista os planos da empresa | 200 |
| GET | `/route-plans/:id` | Consulta um plano | 200 |
| POST | `/route-plans` | Cadastra um plano | 201 |
| PUT | `/route-plans/:id` | Atualiza todos os dados de um plano | 200 |
| PATCH | `/route-plans/:id` | Atualiza parte dos dados de um plano | 200 |
| DELETE | `/route-plans/:id` | Remove o plano, suas entregas e a otimização | 204 |

### Entregas (header `X-API-Key`)

| Método | Endpoint | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/route-plans/:routePlanId/deliveries` | Lista as entregas do plano | 200 |
| GET | `/route-plans/:routePlanId/deliveries/:id` | Consulta uma entrega | 200 |
| POST | `/route-plans/:routePlanId/deliveries` | Adiciona uma entrega ao plano | 201 |
| PUT | `/route-plans/:routePlanId/deliveries/:id` | Atualiza todos os dados de uma entrega | 200 |
| PATCH | `/route-plans/:routePlanId/deliveries/:id` | Atualiza parte dos dados de uma entrega | 200 |
| DELETE | `/route-plans/:routePlanId/deliveries/:id` | Remove uma entrega | 204 |

### Otimização (header `X-API-Key`)

| Método | Endpoint | Descrição | Sucesso |
| --- | --- | --- | --- |
| POST | `/route-plans/:id/optimize` | Calcula e salva a rota otimizada | 200 |
| GET | `/route-plans/:id/optimization` | Consulta a última otimização válida | 200 |

### Administração (header `X-Admin-Key`)

| Método | Endpoint | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/accounts` | Lista empresas (`deleted=all\|true\|false`) | 200 |
| GET | `/accounts/:id` | Consulta uma empresa | 200 |
| POST | `/accounts` | Cadastra uma empresa | 201 |
| PUT | `/accounts/:id` | Atualiza todos os dados de uma empresa | 200 |
| PATCH | `/accounts/:id` | Atualiza parte dos dados de uma empresa | 200 |
| DELETE | `/accounts/:id` | Exclui logicamente uma empresa | 204 |
| GET | `/accounts/:accountId/api-keys` | Lista as chaves da empresa | 200 |
| POST | `/accounts/:accountId/api-keys` | Emite uma chave | 201 |
| DELETE | `/accounts/:accountId/api-keys/:apiKeyId` | Revoga uma chave | 204 |

### Públicos

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/health` | Verifica se a API está no ar |
| GET | `/health/ready` | Verifica PostgreSQL e Redis |
| GET | `/api-docs` (sem `/v1`) | Swagger UI |
| GET | `/api-docs.json` (sem `/v1`) | Especificação OpenAPI em JSON |

### Códigos de resposta

| Código | Quando |
| --- | --- |
| 200 | Consulta ou atualização concluída |
| 201 | Registro criado |
| 204 | Registro removido |
| 400 | JSON malformado |
| 401 | Credencial ausente, inválida, revogada ou expirada |
| 403 | API Key sem o scope necessário |
| 404 | Recurso inexistente ou de outra empresa |
| 409 | Conflito de unicidade ou alteração concorrente |
| 413 | Corpo maior que 1 MB |
| 422 | Dados inválidos ou regra de negócio violada |
| 429 | Limite de requisições excedido |
| 500 | Erro inesperado (sem expor detalhes internos) |
| 502 / 503 / 504 | Falha, ausência de configuração ou timeout do provedor de mapas |

## 11. Exemplos de requisições

**Cadastrar veículo** – `POST /v1/vehicles`

```json
{
  "name": "Van 01",
  "capacity": 100,
  "active": true
}
```

Resposta `201`:

```json
{
  "data": {
    "id": "6f1d1c2e-4a1b-4c3d-9e8f-7a6b5c4d3e2f",
    "accountId": "0b9c8f5e-1d2a-4b3c-8d4e-5f6a7b8c9d0e",
    "name": "Van 01",
    "capacity": 100,
    "active": true,
    "createdAt": "2026-11-24T12:00:00.000Z",
    "updatedAt": "2026-11-24T12:00:00.000Z"
  }
}
```

**Atualizar veículo** – `PUT /v1/vehicles/:id`

```json
{
  "name": "Van 01",
  "capacity": 120,
  "active": false
}
```

**Cadastrar plano de rota** – `POST /v1/route-plans`

```json
{
  "name": "Rota da manhã",
  "depotLatitude": -26.3044,
  "depotLongitude": -48.8487
}
```

**Atualizar parte do plano** – `PATCH /v1/route-plans/:id`

```json
{
  "name": "Rota da tarde"
}
```

**Cadastrar entrega** – `POST /v1/route-plans/:routePlanId/deliveries`

```json
{
  "reference": "PEDIDO-001",
  "latitude": -26.2951,
  "longitude": -48.8458,
  "demand": 10,
  "serviceDurationSeconds": 300
}
```

**Atualizar entrega** – `PUT /v1/route-plans/:routePlanId/deliveries/:id`

```json
{
  "reference": "PEDIDO-001",
  "latitude": -26.2951,
  "longitude": -48.8458,
  "demand": 15,
  "serviceDurationSeconds": 600
}
```

**Otimizar plano** – `POST /v1/route-plans/:id/optimize`

```json
{
  "vehicleIds": ["6f1d1c2e-4a1b-4c3d-9e8f-7a6b5c4d3e2f"],
  "fuelConsumptionKmPerLiter": 10
}
```

**Erro de regra de negócio** – entrega na coordenada do depósito (`422`):

```json
{
  "error": {
    "code": "DELIVERY_AT_DEPOT",
    "message": "A entrega não pode estar na mesma coordenada do depósito.",
    "request_id": "9b2f1d4e-8c3a-4f5b-a6d7-e8f9a0b1c2d3"
  }
}
```

**Erro de validação** (`422`): campos desconhecidos, tipos errados ou corpo vazio em `PATCH`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "details": { "formErrors": [], "fieldErrors": { "body": ["Too small: expected number to be >0"] } },
    "request_id": "9b2f1d4e-8c3a-4f5b-a6d7-e8f9a0b1c2d3"
  }
}
```

Uma coleção Postman com todos os endpoints está em [postman/](postman/).

## 12. Testes automatizados e cobertura

### Ferramentas

- **Vitest**: execução dos testes, mocks (`vi.fn`) e cobertura com `@vitest/coverage-v8`.
- **Supertest**: requisições HTTP à aplicação Express nos testes de integração, sem abrir porta.
- **PostgreSQL real** nos testes de integração, em um banco temporário criado só para a execução.

### Organização

| Pasta / arquivo | Conteúdo |
| --- | --- |
| `tests/unit/services/` | Regras de negócio dos serviços de veículos, planos, entregas, empresas e API Keys, e do objeto `Coordinate`. Os repositórios são substituídos por mocks (`vi.fn`), sem banco. |
| `tests/unit/*.test.ts` | Autenticação por API Key, algoritmo de otimização, provedor Google com `fetch` simulado, simulação de jornada de entregas, rate limit, tratamento de erros HTTP e repositório de contas. |
| `tests/integration/vehicles.test.ts` | CRUD completo de veículos via HTTP: códigos de status, dados retornados, validações, nome duplicado e autenticação. |
| `tests/integration/route-plans.test.ts` | CRUD completo de planos: coordenada inválida, isolamento entre empresas, versão e exclusão. |
| `tests/integration/deliveries.test.ts` | CRUD completo de entregas: referência duplicada, entrega no depósito, plano inexistente, volta do plano para `draft` e exclusão em cascata. |
| `tests/integration/accounts.test.ts` | CRUD de empresas e emissão, uso, listagem e revogação de API Keys. |
| `tests/integration/routing.test.ts` | Fluxo completo com otimização (Google simulado), isolamento entre empresas e concorrência. |
| `tests/integration/redis.test.ts` | Contador atômico do rate limit no Redis. |
| `tests/integration/docs.test.ts` | Swagger UI, especificação OpenAPI, health check e rota inexistente. |
| `tests/support/` | Fábricas de entidades, mocks de repositórios e utilitários de integração. |

### Como executar

Prepare o ambiente uma vez:

```sh
npm install
cp .env.example .env
docker compose up -d --wait
npx prisma generate
```

| Comando | O que executa | Requer banco? |
| --- | --- | --- |
| `npm run test:unit` | Testes unitários | Não |
| `npm run test:integration` | Testes de integração | PostgreSQL e Redis |
| `npm test` | Unitários e depois integração | PostgreSQL e Redis |
| `npm run test:coverage` | Todos os testes com relatório de cobertura | PostgreSQL e Redis |
| `npm run test:watch` | Unitários em modo observação | Não |

O relatório de cobertura é gerado em `coverage/` (abra `coverage/index.html` no navegador; o resumo também aparece no terminal e em `coverage/coverage-summary.json`). O Vitest falha se qualquer métrica ficar abaixo de 60%.

### Cobertura alcançada

Medida sobre todo o código em `src/` (nenhuma camada foi excluída do relatório):

| Métrica | Cobertura | Mínimo exigido |
| --- | --- | --- |
| Instruções (statements) | **91,34%** | 60% |
| Ramificações (branches) | **88,21%** | 60% |
| Funções | **92,30%** | 60% |
| Linhas | **91,96%** | 60% |

Total: 139 testes (92 unitários e 47 de integração), todos aprovados.

### Cuidados com o banco de testes

- `tests/run-integration.ts` cria um banco novo `logfy_test_<aleatório>` no servidor de `DATABASE_URL`, aplica todas as migrations, executa os testes e **apaga o banco ao final**, mesmo se algum teste falhar. O banco de desenvolvimento nunca é alterado.
- Os testes de integração recusam rodar fora desse banco temporário, evitando apagar dados reais por engano.
- O usuário do PostgreSQL precisa de permissão para criar bancos (`CREATEDB`); o usuário do `docker-compose.yml` já possui.
- Cada arquivo cria empresas com slug aleatório e as remove no `afterAll` (a exclusão em cascata limpa veículos, planos e entregas), então os testes podem ser executados repetidamente sem interferência.
- Os arquivos de integração rodam em sequência (`fileParallelism: false`).
- Nenhum teste chama o Google Maps; o provedor é simulado.

### Integração contínua

O workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) sobe PostgreSQL e Redis, executa `typecheck`, `build` e `test:coverage` a cada push na `main` e em pull requests, e publica o relatório de cobertura como artefato.

## 13. Documentação Swagger

Com a aplicação rodando (`npm run dev`), acesse:

- **Swagger UI:** http://localhost:3000/api-docs
- **Especificação em JSON:** http://localhost:3000/api-docs.json

Na interface, os endpoints estão agrupados por entidade (Vehicles, Route Plans, Deliveries, Routing, Accounts, API Keys, Health). Cada operação mostra a finalidade, os parâmetros de rota e de consulta, o formato do corpo com exemplo, as respostas e os códigos HTTP.

Para testar pela própria página:

1. Clique em **Authorize**.
2. Informe a API Key em `ApiKeyAuth` (para veículos, planos, entregas e otimização) e/ou a credencial administrativa em `AdminKeyAuth` (para empresas e chaves).
3. Abra um endpoint, clique em **Try it out**, ajuste o exemplo e clique em **Execute**.

## Informações complementares

### Otimização de rotas

A matriz de distâncias vem da [Google Routes API](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix) (`DRIVE`, sem tráfego em tempo real), em lotes de até 25 × 25 pontos. O algoritmo `capacity-cheapest-insertion-v1` distribui as entregas entre os veículos pela menor inserção de tempo, respeitando a capacidade, o tempo de atendimento e o retorno ao depósito. É uma heurística: não garante o ótimo global. Se não encontrar uma distribuição completa, retorna `422 OPTIMIZATION_INCOMPLETE` sem salvar resultado parcial. O resultado traz as paradas em ordem e a comparação de distância, tempo e combustível com a ordem de cadastro.

### Segurança

- Credenciais e segredos ficam apenas em variáveis de ambiente; `.env` está no `.gitignore`.
- API Keys são armazenadas como hash SHA-256 e a credencial administrativa é comparada em tempo constante.
- Headers `X-API-Key` e `X-Admin-Key` são ocultados dos logs.
- Helmet, CORS restrito por configuração, limite de 1 MB no corpo e rate limit distribuído por IP no Redis (`429` com `Retry-After`).

### Teste de carga

`scripts/load-test-rps.mjs` (taxa fixa) e `scripts/load-test.mjs` (concorrência fixa) medem o desempenho das rotas de leitura. Exigem a API em execução e `LOAD_API_KEY` com `routing:read`. Antes de medir, aumente `RATE_LIMIT_MAX`, senão o resultado mostrará apenas respostas `429`:

```sh
LOAD_API_KEY='lgfy_test_...' node scripts/load-test-rps.mjs
LOAD_API_KEY='lgfy_test_...' RATES=500,1000 STAGE_SECONDS=60 node scripts/load-test-rps.mjs
```
