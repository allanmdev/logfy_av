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

{"vehicleIds":["VEHICLE_ID"],"fuelConsumptionKmPerLiter":10}
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

### Testar pelo Postman

1. Importe a [coleção com os 27 endpoints](postman/logfy.postman_collection.json) e o [ambiente local](postman/local.postman_environment.json).
2. Selecione o ambiente **Logfy · Local**, ajuste `baseUrl` se necessário (padrão `http://localhost:3000/v1`) e preencha `adminKey` com o mesmo valor de `ADMIN_API_KEY` configurado no servidor.
3. Com o banco migrado e a API iniciada (`npm run dev`), execute as requisições na ordem das pastas. As criações salvam automaticamente `accountId`, `apiKeyId`, `apiKey`, `vehicleId`, `routePlanId` e `deliveryId` nas variáveis da coleção. Não crie variáveis de ambiente com esses nomes, pois elas sobrepõem os valores capturados.
4. Cada requisição inclui nome, descrição dos parâmetros, corpo de exemplo quando aplicável e uma verificação do status HTTP esperado. Para repetir o fluxo, comece pela criação da conta; um slug novo é gerado a cada execução.

A pasta **07 · Otimização** exige a configuração do Google Maps descrita acima e faz chamadas reais, sujeitas a cobrança. Sem essa configuração, pule essa pasta; os testes de status dela não passarão. Execute a pasta **08 · Limpeza** somente ao terminar: ela exclui os recursos de teste, revoga a chave e faz a exclusão lógica da conta. O Collection Runner executa também essas pastas se estiverem selecionadas.

As credenciais ficam vazias nos arquivos de importação. A chave da conta é retornada somente na criação e fica armazenada localmente pelo Postman; remova os valores antes de compartilhar uma exportação.

### Testes automatizados

Os testes usam o executor nativo do Node.js (`node:test`), as asserções de `node:assert/strict` e o `tsx` para executar TypeScript. Execute os comandos abaixo na raiz do projeto.

#### Preparar o ambiente

Instale as dependências e gere o cliente Prisma:

```sh
npm ci
# Copie apenas se ainda não existir um .env, preservando sua configuração.
cp -n .env.example .env
npx prisma generate
```

O `.env` precisa conter `DATABASE_URL` mesmo para os testes com banco simulado, pois alguns módulos inicializam o cliente Prisma ao serem importados. A suíte padrão não exige PostgreSQL ou Redis em execução, migrations aplicadas nem uma chave real do Google. Os testes HTTP iniciam e encerram seus próprios servidores em portas locais disponíveis; não é necessário executar `npm run dev`.

#### Executar a suíte padrão

```sh
npm test
```

Esse comando executa somente `tests/*.test.ts`; os arquivos em `tests/integration/` ficam fora dele. Repositórios, respostas do Google e armazenamento do rate limit são substituídos por implementações controladas em memória (mocks), conforme o teste.

Para executar apenas um arquivo ou filtrar um cenário pelo nome:

```sh
npx tsx --test tests/delivery-simulation.test.ts
npx tsx --test tests/routing-optimizer.test.ts
npx tsx --test --test-name-pattern="otimiza a jornada" tests/delivery-simulation.test.ts
```

Na saída, cada cenário aparece como aprovado (`ok`/✔) ou reprovado (`not ok`/✖), dependendo do formato do relatório. Uma falha mostra a asserção e a localização no código; o processo termina com código diferente de zero. As mensagens emitidas por `t.diagnostic`, como os eventos da jornada da Ana, são informações adicionais e não representam falhas.

#### O que cada arquivo testa

| Arquivo | Cenários verificados |
| --- | --- |
| [accounts-list.test.ts](tests/accounts-list.test.ts) | Listagem HTTP de contas com Prisma simulado: filtros `deleted=false`, `deleted=true` e `deleted=all`, paginação, página sem resultados e ordenação por criação e ID decrescentes. Confirma que a consulta padrão inclui contas excluídas e que parâmetros inválidos retornam `422` antes de consultar o repositório. |
| [api-key-authentication.test.ts](tests/api-key-authentication.test.ts) | Autenticação consulta apenas o hash SHA-256, retorna conta, ID da chave e scopes sem credenciais, e registra o uso da chave válida. Rejeita chave desconhecida, revogada ou expirada e conta suspensa, inativa ou excluída sem registrar uso. Chaves malformadas são rejeitadas antes de consultar o repositório. |
| [prisma-account.repository.test.ts](tests/prisma-account.repository.test.ts) | Quatro cenários com erros Prisma simulados: em `create` e `update`, conflito de unicidade (`P2002`) vira `409`, com os códigos `ACCOUNT_ALREADY_EXISTS` e `ACCOUNT_SLUG_ALREADY_EXISTS`, respectivamente; em ambas as operações, erros inesperados são propagados sem substituição. |
| [http-security.test.ts](tests/http-security.test.ts) | Três cenários HTTP: excesso de requisições retorna `429`, com headers de limite, sem permitir contorno por `X-Forwarded-For` forjado; falha no armazenamento do limite retorna `503` sem expor detalhes internos; JSON inválido e corpo grande retornam `400` e `413` com código de erro e identificação da requisição. |
| [google-maps-matrix.test.ts](tests/google-maps-matrix.test.ts) | Com `fetch` simulado, aceita distâncias zero omitidas, reorganiza índices fora de ordem, interpreta segundos decimais e representa trechos inacessíveis. Confere a divisão de 26 pontos em quatro lotes de até 625 elementos. Rejeita células ausentes ou duplicadas, índice fora dos limites, erro em elemento, duração ausente ou inválida e formato JSON incorreto. Verifica ausência de configuração (`503`), falha HTTP do provedor (`502`, sem expor a chave) e timeout (`504`). |
| [routing-optimizer.test.ts](tests/routing-optimizer.test.ts) | Cinco cenários: custos diferentes por sentido, atendimento e retorno ao depósito; cada entrega atribuída uma única vez respeitando a capacidade dos veículos; recusa de solução parcial para entregas inacessíveis ou capacidade insuficiente; recusa de matriz com dimensões inválidas ou custos negativos; validações do caso de uso antes de chamar o provedor, rejeição de veículos duplicados e ausência de salvamento quando o cálculo falha. |
| [delivery-simulation.test.ts](tests/delivery-simulation.test.ts) | Três cenários com dados locais: criação de planos e entregas, jornada na ordem de cadastro e comparação com a jornada otimizada. Os resultados e os logs estão detalhados abaixo. |

#### Simulação de entregas: jornada da Ana

O arquivo `delivery-simulation.test.ts` executa os casos de uso reais com repositórios e matriz de distâncias simulados:

1. **Cria várias rotas com entregas vinculadas à conta e ao plano correto:** cria três planos (Norte, Sul e Centro), com quatro entregas cada. Verifica IDs distintos, status inicial `draft`, vínculo com a conta e o plano e os argumentos enviados aos repositórios.
2. **Simula Ana fazendo entregas na ordem de cadastro com logs de cada etapa:** percorre três entregas sem reordená-las e confere a sequência de saída, chegada, conclusão e retorno ao depósito. Valida os tempos acumulados, a distância e o horário final da simulação.
3. **Otimiza a jornada de entregas e reduz distância e tempo com logs:** usa o otimizador real, verifica a consulta da matriz e o salvamento do resultado, a capacidade da van, a sequência das paradas e a presença de todas as entregas. Compara os totais e os horários de chegada calculados com a simulação do percurso e estima o consumo de gasolina considerando 10 km/l constantes.

| Medida | Ordem de cadastro | Rota otimizada |
| --- | --- | --- |
| Distância, incluindo retorno | 8 km | 6 km |
| Tempo, incluindo atendimento e retorno | 980 s (16 min 20 s) | 780 s (13 min) |
| Gasolina estimada a 10 km/l | 0,80 L | 0,60 L |

Nesse cenário, a economia é de 2 km, 200 segundos (20,41%) e 0,20 L (25%). São valores definidos pela matriz fictícia do teste, não medições do Google ou garantia de economia em rotas reais. A estimativa de combustível é calculada pelo próprio teste.

Os logs incluem `event`, `driver`, `deliveryId` quando aplicável, `elapsed` (segundos acumulados) e `timestamp` (horário simulado). O tempo avança por cálculo, sem esperar os minutos da jornada transcorrerem.

#### Executar os testes de integração

Com Docker e Docker Compose disponíveis, inicie as dependências locais e aguarde ficarem prontas:

```sh
docker compose up -d --wait postgres redis
npm run test:integration
```

Configure `DATABASE_URL` e `REDIS_URL` no `.env` para apontar para essas instâncias; os valores de `.env.example` correspondem ao Compose. Também é possível usar instâncias de teste já disponíveis. O banco indicado por `DATABASE_URL` deve existir e seu usuário PostgreSQL precisa de permissão para criar bancos (`CREATEDB` ou equivalente).

O script [tests/run-integration.ts](tests/run-integration.ts) carrega o `.env`, cria um banco `logfy_test_<valor aleatório>` no mesmo servidor, aplica todas as migrations e executa os dois arquivos abaixo. Ele define `NODE_ENV=test`, gera uma chave administrativa temporária e remove o banco em um bloco `finally`, inclusive quando um teste falha. Uma interrupção forçada do processo pode impedir essa limpeza. As tabelas do banco da aplicação não são usadas pelos testes.

| Arquivo | Cenários verificados |
| --- | --- |
| [integration/routing.test.ts](tests/integration/routing.test.ts) | Um fluxo integrado com HTTP, PostgreSQL e Redis reais: saúde pública, autenticação administrativa e por API Key, restrição de scopes, isolamento entre duas contas, cadastros e alterações de planos, entregas e veículos, validação de parâmetros e conflitos. Verifica persistência e substituição da otimização, invalidação após mudanças, proteção contra gravações concorrentes, hash e último uso da chave, rejeição de credenciais/contas inválidas e exclusão em cascata. O provedor Google é simulado. |
| [integration/redis.test.ts](tests/integration/redis.test.ts) | Dois clientes Redis fazem 30 incrementos concorrentes no mesmo contador. Verifica que cada incremento recebe um número único de 1 a 30, que a janela tem expiração e que o contador reinicia após expirar. Usa uma chave aleatória e tenta removê-la ao finalizar. |

Execute o fluxo de integração pelo script npm: `routing.test.ts` recusa execução direta sem a identificação do banco temporário. Não é necessário iniciar a API separadamente nem configurar uma chave real do Google; não há chamadas externas ao Google ou consumo de crédito nesses testes. O Redis usado é o indicado por `REDIS_URL`, com chaves de teste; o script não cria uma instância Redis separada.

Se houver erro de conexão, confira `docker compose ps` e as URLs do `.env`. Erro de permissão em `CREATE DATABASE` exige ajustar o usuário do PostgreSQL. Se o fluxo HTTP retornar `429`, confira `RATE_LIMIT_MAX`: a integração herda essa configuração e o padrão do projeto é 120.

#### Verificações complementares

```sh
npm run typecheck
npm run build
```

`typecheck` verifica os tipos sem gerar arquivos; `build` compila a aplicação em `dist/`. Esses comandos complementam as suítes, mas não executam testes.

### Teste de carga

Os scripts em `scripts/` exigem uma API em execução, com PostgreSQL e Redis, e uma chave com `routing:read` em `LOAD_API_KEY`. Eles chamam somente rotas de leitura (`/v1/vehicles` e `/v1/route-plans`, ajustáveis em `LOAD_PATHS`), sem chamadas ao Google. Rode-os apenas contra ambientes que você controla.

**Antes de medir capacidade, suba o limite por IP na API de teste.** Com o padrão `RATE_LIMIT_MAX=120` por minuto, todas as requisições depois da 120ª retornam `429` e o resultado mostra apenas o rate limit. Defina um valor alto no `.env` (por exemplo `RATE_LIMIT_MAX=10000000`), reinicie a API e, se o contador ainda estiver cheio, aguarde `RATE_LIMIT_WINDOW_MS` ou reinicie o Redis. Restaure o valor original depois do teste.

`scripts/load-test-rps.mjs` executa etapas com taxa fixa, independentemente da velocidade das respostas (modelo *open-loop*), e compara todas ao final. O padrão é 100, 200, 300 e 5000 req/s, 30 s cada:

```sh
LOAD_API_KEY='lgfy_test_...' node scripts/load-test-rps.mjs

LOAD_API_KEY='lgfy_test_...' RATES=500,1000 STAGE_SECONDS=60 RESULT_FILE=resultado.json node scripts/load-test-rps.mjs
```

| Variável | Padrão | Uso |
| --- | --- | --- |
| `BASE_URL` | `http://127.0.0.1:3000` | Origem da API. |
| `RATES` | `100,200,300,5000` | Taxas alvo em req/s, separadas por vírgula. |
| `STAGE_SECONDS` | `30` | Duração de cada etapa. |
| `COOLDOWN_SECONDS` | `5` | Pausa entre etapas. |
| `TIMEOUT_MS` | `10000` | Timeout por requisição; excedido, conta como erro de rede (`timeout`). |
| `MAX_INFLIGHT` | `1000` | Máximo de requisições simultâneas do gerador. |
| `MAX_P95_MS` | `1000` | Limite de p95 para aprovar a etapa. |
| `MAX_ERROR_RATE` | `0.01` | Taxa máxima de erros para aprovar a etapa. |
| `MAX_DROPPED_RATE` | `0.05` | Máximo de requisições descartadas para aprovar a etapa. |
| `RESULT_FILE` | vazio | Grava o resultado completo em JSON neste arquivo. |

Durante a etapa, uma linha a cada 5 s mostra `enviadas`, `erros`, `descartadas` e `em_voo`. `em_voo` são as requisições enviadas que ainda aguardam resposta; um valor que só cresce indica que a API não acompanha a taxa. `descartadas` são requisições que o gerador deveria enviar, mas não enviou por atingir `MAX_INFLIGHT`; não são erros da API, e sim taxa abaixo do alvo.

O resultado final é uma tabela com uma linha por taxa:

| Coluna | Significado |
| --- | --- |
| `alvo req/s` | Taxa configurada para a etapa. |
| `enviadas/s`, `200/s` | Requisições enviadas e respondidas com HTTP 200 por segundo. |
| `erros` | Porcentagem de respostas diferentes de 200 e falhas de rede sobre as enviadas. |
| `429`, `5xx`, `rede` | `429` indica rate limit; `5xx` inclui `503` quando o Redis falha; `rede` reúne timeouts, `ECONNRESET` e semelhantes. |
| `p50`, `p95`, `p99`, `máx` | Latência em ms, apenas das respostas 200. Respostas `429` são rápidas e mascarariam a lentidão real. |
| `descartadas` | Requisições não enviadas por `MAX_INFLIGHT`. |
| `resultado` | `OK` ou `FALHOU`, com o motivo listado abaixo da tabela, junto da maior taxa aprovada. |

O código de saída é `0` se todas as etapas passarem, `1` se alguma falhar e `130` se interrompido com Ctrl+C. O script avisa no início quando o limite da API é menor que o total de requisições planejado.

A taxa de 5000 req/s roda em um único processo Node e disputa CPU com a API se estiverem na mesma máquina; o script avisa quando o agendamento atrasa mais de 100 ms. Para medir esse valor com confiança, execute o gerador em outra máquina. O limite de arquivos abertos (`ulimit -n`) precisa ser maior que `MAX_INFLIGHT`.

`scripts/load-test.mjs` usa outro modelo (*closed-loop*): `CONCURRENCY` workers repetem requisições em sequência, então a taxa depende da velocidade da API. Aceita `BASE_URL`, `LOAD_API_KEY`, `LOAD_PATHS`, `CONCURRENCY` (padrão 20), `DURATION_SECONDS` (60), `RAMP_SECONDS` (10), `TIMEOUT_MS`, `MAX_P95_MS` e `MAX_ERROR_RATE`, e imprime um único resumo JSON. Use-o para medir quanto a API sustenta com uma concorrência fixa; use `load-test-rps.mjs` para verificar se ela aguenta uma taxa específica.

## Redis e proteção HTTP

Execute `docker compose up -d` antes de iniciar a API. `REDIS_URL` usa `redis://127.0.0.1:6379` por padrão. PostgreSQL e Redis são publicados somente na interface local pelo Compose. Em produção, configure Redis em rede privada com autenticação e TLS (`rediss://`).

O limite distribuído por IP usa uma janela fixa atômica no Redis: `RATE_LIMIT_MAX=120` e `RATE_LIMIT_WINDOW_MS=60000`. Requisições excedentes recebem HTTP 429 e `Retry-After`; indisponibilidade do Redis bloqueia as rotas de negócio com HTTP 503. O contador e sua expiração são atualizados pelo mesmo script Lua, conforme a [documentação do Redis](https://redis.io/docs/latest/commands/incr/). O limite vale por IP e é baixo por padrão; testes de carga o esgotam em segundos (veja [Teste de carga](#teste-de-carga)).

`CORS_ORIGINS` aceita origens separadas por vírgula. Vazio desabilita o acesso entre origens pelo navegador. `TRUST_PROXY` aceita endereços ou sub-redes dos proxies confiáveis separados por vírgula; vazio usa o endereço da conexão. Configure apenas proxies controlados que substituam os cabeçalhos encaminhados.

`GET /v1/health` verifica o processo; `GET /v1/health/ready` verifica PostgreSQL e Redis e retorna 503 se alguma dependência falhar. Esses endpoints não consomem o limite. A inicialização exige as duas dependências, e SIGINT/SIGTERM drenam requisições e encerram conexões com prazo de dez segundos.
