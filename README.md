# Logfy API

API multi-tenant em Node.js, TypeScript, Express e Prisma/PostgreSQL. Cada API Key identifica uma Account; os recursos de roteirização usam exclusivamente a conta autenticada.

## Configuração

```sh
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Configure `DATABASE_URL`, `ADMIN_API_KEY` e `GOOGLE_MAPS_API_KEY` no `.env`. Gere uma credencial administrativa aleatória de pelo menos 32 caracteres; os valores de exemplo devem ser substituídos. Habilite a **Routes API** e o faturamento no projeto Google Cloud e restrinja a chave à API e ao ambiente do servidor.

| Variável | Uso |
| --- | --- |
| `ADMIN_API_KEY` | Credencial administrativa para os endpoints existentes de accounts e api-keys. Sem configuração, esses endpoints recusam acesso. |
| `GOOGLE_MAPS_API_KEY` | Credencial do Google Routes. Sem configuração, otimizar retorna `503 MAPS_NOT_CONFIGURED`; os cadastros continuam disponíveis. |
| `GOOGLE_MAPS_TIMEOUT_MS` | Timeout por lote da matriz; padrão: 10000 ms. |
| `ROUTING_MAX_DELIVERIES` | Máximo de entregas por otimização; padrão: 100, configurável entre 1 e 500. |

## Autenticação e autorização

- Administração: envie `X-Admin-Key` para `/v1/accounts` e `/v1/accounts/:accountId/api-keys`. Isso permite provisionar a primeira conta e sua chave sem expor criação de credenciais publicamente. Os contratos desses endpoints foram preservados; a autenticação administrativa é obrigatória.
- Roteirização: envie a chave completa em `X-API-Key`. A chave é retornada apenas na criação; o banco armazena seu hash SHA-256. As chaves emitidas atualmente usam o formato `lgfy_test_` seguido de 64 caracteres hexadecimais.
- Leituras exigem `routing:read`; criação, alteração, exclusão e otimização exigem `routing:write`. Um scope não implica o outro.
- Chaves desconhecidas, expiradas ou revogadas, e contas suspensas, inativas ou excluídas, recebem `401`. Scope insuficiente recebe `403`. Identificadores de outra empresa recebem `404`.
- A requisição atualiza `lastUsedAt` após autenticação. Os headers de credenciais são ocultados dos logs.
- `GET /v1/health` permanece público.

## Endpoints de roteirização

Todos os caminhos abaixo são relativos a `/v1`.

| Método | Caminho | Operação |
| --- | --- | --- |
| POST | `/route-plans` | Criar plano e depósito |
| GET | `/route-plans` | Listar planos da conta |
| GET | `/route-plans/:id` | Consultar plano |
| PATCH | `/route-plans/:id` | Alterar nome ou depósito |
| DELETE | `/route-plans/:id` | Excluir plano, entregas e resultado |
| POST | `/route-plans/:routePlanId/deliveries` | Adicionar entrega |
| GET | `/route-plans/:routePlanId/deliveries` | Listar entregas do plano |
| GET | `/route-plans/:routePlanId/deliveries/:id` | Consultar entrega |
| PATCH | `/route-plans/:routePlanId/deliveries/:id` | Alterar entrega |
| DELETE | `/route-plans/:routePlanId/deliveries/:id` | Excluir entrega |
| POST | `/vehicles` | Cadastrar veículo |
| GET | `/vehicles` | Listar veículos da conta |
| GET | `/vehicles/:id` | Consultar veículo |
| PATCH | `/vehicles/:id` | Alterar veículo |
| DELETE | `/vehicles/:id` | Excluir veículo |
| POST | `/route-plans/:id/optimize` | Calcular e persistir otimização |
| GET | `/route-plans/:id/optimization` | Consultar último resultado válido |

Listagens aceitam `page` e `limit` (padrões 1 e 20, limite máximo 100), retornando `{ data, pagination: { page, limit, total, totalPages } }`. Criações retornam `201`, consultas, alterações e otimização `200`, exclusões `204`. Outros resultados usam `{ data }` e erros mantêm o envelope `{ error: { code, message, details, request_id } }` existente.

### Exemplo de uso

Crie uma conta com `X-Admin-Key`:

```http
POST /v1/accounts
Content-Type: application/json
X-Admin-Key: SUA_CREDENCIAL_ADMINISTRATIVA

{"name":"Transportadora","slug":"transportadora"}
```

Use o `id` retornado para emitir uma chave:

```http
POST /v1/accounts/ACCOUNT_ID/api-keys
Content-Type: application/json
X-Admin-Key: SUA_CREDENCIAL_ADMINISTRATIVA

{"name":"Roteirizacao","scopes":["routing:read","routing:write"]}
```

Envie `data.key` como `X-API-Key` nas próximas chamadas:

```http
POST /v1/vehicles
Content-Type: application/json
X-API-Key: SUA_API_KEY

{"name":"Van 01","capacity":100}
```

```http
POST /v1/route-plans
Content-Type: application/json
X-API-Key: SUA_API_KEY

{"name":"Rota da manhã","depotLatitude":-23.5505,"depotLongitude":-46.6333}
```

```http
POST /v1/route-plans/PLAN_ID/deliveries
Content-Type: application/json
X-API-Key: SUA_API_KEY

{"reference":"PEDIDO-001","latitude":-23.5614,"longitude":-46.6559,"demand":10,"serviceDurationSeconds":300}
```

```http
POST /v1/route-plans/PLAN_ID/optimize
Content-Type: application/json
X-API-Key: SUA_API_KEY

{"vehicleIds":["VEHICLE_ID"]}
```

`PLAN_ID`, `VEHICLE_ID` e `ACCOUNT_ID` representam os CUIDs retornados pela API. `accountId` não é aceito nos corpos de roteirização. Latitude deve estar entre -90 e 90; longitude entre -180 e 180. `capacity` e `demand` são inteiros positivos na mesma unidade definida pela empresa. `active` é `true` por padrão; `serviceDurationSeconds` é 0 por padrão e aceita até 86400 segundos. A referência da entrega é única dentro do plano. Campos desconhecidos e patches vazios são rejeitados com `422`.

## Matriz e otimização

O adaptador Google chama [computeRouteMatrix](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRouteMatrix) com `DRIVE` e `TRAFFIC_UNAWARE`. As distâncias são viárias, em metros, e as durações são em segundos. Não há estimativa por linha reta nem fallback fictício. As coordenadas devem ser fornecidas; esta fase não faz geocodificação de endereços.

A matriz inclui o depósito e todas as entregas. Lotes de até 25 origens por 25 destinos respeitam o máximo de 625 elementos por chamada. A resposta é reconstruída pelos índices; pares sem rota são inacessíveis. Respostas incompletas, duplicadas ou inválidas causam `502`; timeout causa `504`. A quantidade de elementos cresce quadraticamente e as chamadas podem gerar cobrança no Google. A otimização é síncrona, sem tráfego em tempo real.

A engine `capacity-cheapest-insertion-v1` ordena entregas por demanda e escolhe a inserção com menor acréscimo de tempo de viagem entre os veículos com capacidade disponível. Considera a matriz direcionada, o tempo de serviço e o retorno ao depósito. Cada entrega é visitada uma vez, sem divisão de carga. Veículos não utilizados são omitidos do resultado. A engine é uma heurística: não garante o ótimo global e pode não encontrar uma distribuição mesmo quando outra combinação seria possível. Nesse caso retorna `422 OPTIMIZATION_INCOMPLETE`, sem salvar uma solução parcial. Não há janelas de atendimento, múltiplos depósitos ou turnos nesta fase.

O resultado inclui o algoritmo, o provedor da matriz, o depósito, os veículos usados, a carga, as paradas ordenadas, o deslocamento de cada trecho, os segundos decorridos até a chegada, o retorno ao depósito e os totais de distância e duração. A duração total soma deslocamentos, serviços e retornos de todos os veículos; não representa a duração paralela da operação inteira.

## Persistência e concorrência

`RoutePlan`, `Delivery`, `Vehicle` e `RouteOptimization` possuem identificação da conta. As relações compostas de entregas e resultados com o plano também garantem essa associação no PostgreSQL.

O resultado é armazenado em JSONB com snapshots das informações usadas nas rotas. Há um resultado por plano. Otimizar novamente substitui o anterior em uma transação e muda o status para `optimized`. Uma falha de cálculo preserva o resultado anterior.

Alterar o plano ou criar, alterar ou excluir entregas invalida o resultado e retorna o plano para `draft`, na mesma transação. O salvamento verifica a versão do plano e a última alteração dos veículos; alterações concorrentes retornam `409 CONCURRENT_MODIFICATION`. Chamadas ao Google acontecem fora das transações do banco.

Alterações posteriores no cadastro de veículos preservam o resultado como snapshot da otimização já realizada. Para usar os novos dados, otimize novamente. Exclusões de planos, entregas e veículos são definitivas; excluir um plano remove suas entregas e seu resultado em cascata.

## Arquitetura

Os módulos `route-plans`, `deliveries` e `vehicles` seguem a separação existente entre entidades e contratos de repositório, DTOs e casos de uso, repositórios Prisma, schemas Zod, controllers e rotas HTTP. A composição manual fica em `src/shared/container`.

O módulo `routing` concentra a orquestração e os contratos `DistanceMatrixProvider` e `RouteOptimizer`. Os adaptadores atuais são `GoogleMapsDistanceMatrixProvider` e `CheapestInsertionOptimizer`. Para trocar o provedor ou algoritmo, implemente o respectivo contrato e altere a composição em `routing.container.ts`. Controllers e entidades não dependem dos adaptadores.

## Verificação

```sh
npm run typecheck
npm run build
npm test
npm run test:integration
```

Os testes de integração criam um banco temporário com nome aleatório no servidor indicado por `DATABASE_URL`, aplicam todas as migrations, executam o fluxo HTTP e removem esse banco ao terminar. O usuário PostgreSQL precisa de permissão para criar bancos. Os dados da aplicação não são usados pelos testes. O adaptador Google é simulado, sem chamadas externas ou consumo de crédito; seus contratos, lotes e falhas são testados separadamente.
