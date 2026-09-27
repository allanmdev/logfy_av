import http from 'node:http';
import https from 'node:https';
import { writeFile } from 'node:fs/promises';
import { createHistogram, performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

function number(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} deve estar entre ${min} e ${max}.`);
  }
  return value;
}

function integer(name, fallback, min, max) {
  const value = number(name, fallback, min, max);
  if (!Number.isInteger(value)) throw new Error(`${name} deve ser inteiro.`);
  return value;
}

function parseRates(value) {
  const rates = value.split(',').map((item) => Number(item.trim()));
  if (!rates.length || rates.some((rate) => !Number.isInteger(rate) || rate < 1 || rate > 100000)) {
    throw new Error('RATES deve conter inteiros entre 1 e 100000 separados por vírgula.');
  }
  return rates;
}

const ms = (histogram, percentile) => percentile === 100 ? histogram.max / 1000 : histogram.percentile(percentile) / 1000;

function summarize(histogram) {
  if (!histogram.count) return null;
  return { p50_ms: ms(histogram, 50), p95_ms: ms(histogram, 95), p99_ms: ms(histogram, 99), max_ms: ms(histogram, 100) };
}

function printTable(rows) {
  const columns = [
    ['alvo req/s', (r) => r.target_rps],
    ['enviadas/s', (r) => r.sent_per_second.toFixed(0)],
    ['200/s', (r) => r.successful_per_second.toFixed(0)],
    ['erros', (r) => `${(r.error_rate * 100).toFixed(1)}%`],
    ['429', (r) => r.statuses[429] ?? 0],
    ['5xx', (r) => Object.entries(r.statuses).filter(([status]) => status >= 500).reduce((sum, [, count]) => sum + count, 0)],
    ['rede', (r) => Object.values(r.network_errors).reduce((sum, count) => sum + count, 0)],
    ['p50 ms', (r) => r.successful_latency?.p50_ms.toFixed(1) ?? '-'],
    ['p95 ms', (r) => r.successful_latency?.p95_ms.toFixed(1) ?? '-'],
    ['p99 ms', (r) => r.successful_latency?.p99_ms.toFixed(1) ?? '-'],
    ['máx ms', (r) => r.successful_latency?.max_ms.toFixed(1) ?? '-'],
    ['descartadas', (r) => r.dropped],
    ['resultado', (r) => r.passed ? 'OK' : 'FALHOU'],
  ];
  const cells = [columns.map(([title]) => title), ...rows.map((row) => columns.map(([, value]) => String(value(row))))];
  const widths = columns.map((_, index) => Math.max(...cells.map((line) => line[index].length)));
  const format = (line) => line.map((cell, index) => cell.padStart(widths[index])).join('  ');
  console.log(format(cells[0]));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const line of cells.slice(1)) console.log(format(line));
}

async function main() {
  const base = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('BASE_URL deve ser uma URL HTTP sem credenciais.');
  }
  const apiKey = process.env.LOAD_API_KEY;
  if (!apiKey) throw new Error('Defina LOAD_API_KEY com uma chave que tenha routing:read.');
  const rates = parseRates(process.env.RATES ?? '100,200,300,5000');
  const duration = number('STAGE_SECONDS', 30, 1, 3600);
  const cooldown = number('COOLDOWN_SECONDS', 5, 0, 600);
  const timeout = number('TIMEOUT_MS', 10000, 1, 120000);
  const maxInflight = integer('MAX_INFLIGHT', 1000, 1, 20000);
  const p95Limit = number('MAX_P95_MS', 1000, 1, 120000);
  const errorLimit = number('MAX_ERROR_RATE', 0.01, 0, 1);
  const droppedLimit = number('MAX_DROPPED_RATE', 0.05, 0, 1);
  const resultFile = process.env.RESULT_FILE;
  const paths = (process.env.LOAD_PATHS ?? '/v1/vehicles?limit=20,/v1/route-plans?limit=20').split(',');
  const urls = paths.map((path) => {
    if (!path.startsWith('/v1/') || path.startsWith('/v1/health')) {
      throw new Error('LOAD_PATHS deve conter rotas de negócio /v1/ separadas por vírgula.');
    }
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error('Todas as rotas devem usar a mesma origem.');
    return url;
  });

  const client = base.protocol === 'https:' ? https : http;
  const agent = new client.Agent({ keepAlive: true, maxSockets: maxInflight });
  const headers = { 'x-api-key': apiKey, accept: 'application/json' };
  const request = (url) => new Promise((resolve, reject) => {
    const req = client.request(url, { agent, headers, signal: AbortSignal.timeout(timeout) }, (res) => {
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => resolve({ status: res.statusCode, bytes, headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });

  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    agent.destroy();
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);

  async function runStage(rate) {
    const latency = createHistogram();
    const successLatency = createHistogram();
    const statuses = {};
    const networkErrors = {};
    const endpoints = Object.fromEntries(paths.map((path) => [path, { requests: 0, errors: 0 }]));
    const planned = rate * duration;
    let due = 0;
    let sent = 0;
    let dropped = 0;
    let errors = 0;
    let inflight = 0;
    let bytes = 0;
    let maxLagMs = 0;

    const fire = async (index) => {
      const endpoint = endpoints[paths[index]];
      const start = performance.now();
      let ok = false;
      inflight++;
      try {
        const response = await request(urls[index]);
        bytes += response.bytes;
        statuses[response.status] = (statuses[response.status] ?? 0) + 1;
        ok = response.status === 200;
      } catch (error) {
        const kind = error.name === 'AbortError' ? 'timeout' : error.code ?? error.name ?? 'Error';
        networkErrors[kind] = (networkErrors[kind] ?? 0) + 1;
      } finally {
        inflight--;
      }
      const elapsedUs = Math.max(1, Math.round((performance.now() - start) * 1000));
      latency.record(elapsedUs);
      if (ok) successLatency.record(elapsedUs);
      endpoint.requests++;
      if (!ok) {
        errors++;
        endpoint.errors++;
      }
    };

    const started = performance.now();
    const end = started + duration * 1000;
    const progress = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      console.log(`  [${rate} req/s] ${Math.round(elapsed)}s enviadas=${sent} erros=${errors} descartadas=${dropped} em_voo=${inflight}`);
    }, 5000);
    try {
      await new Promise((resolve) => {
        const tick = () => {
          const now = performance.now();
          if (interrupted) return resolve();
          const target = Math.min(Math.floor((Math.min(now, end) - started) * rate / 1000), planned);
          if (target > due) maxLagMs = Math.max(maxLagMs, now - (started + due * 1000 / rate));
          while (due < target) {
            const index = due++ % urls.length;
            if (inflight >= maxInflight) {
              dropped++;
              continue;
            }
            sent++;
            fire(index);
          }
          if (now >= end) return resolve();
          setTimeout(tick, 1);
        };
        tick();
      });
      const drainDeadline = performance.now() + timeout + 1000;
      while (inflight > 0 && !interrupted && performance.now() < drainDeadline) await sleep(20);
    } finally {
      clearInterval(progress);
    }

    const errorRate = sent ? errors / sent : 1;
    const droppedRate = planned ? dropped / planned : 0;
    const failures = [];
    if (interrupted) failures.push('interrompido');
    if (errorRate > errorLimit) failures.push(`erros ${(errorRate * 100).toFixed(1)}% > ${(errorLimit * 100).toFixed(1)}%`);
    if (!successLatency.count) failures.push('nenhuma resposta HTTP 200');
    else if (ms(successLatency, 95) > p95Limit) failures.push(`p95 ${ms(successLatency, 95).toFixed(1)}ms > ${p95Limit}ms`);
    if (droppedRate > droppedLimit) failures.push(`gerador descartou ${(droppedRate * 100).toFixed(1)}% das requisições (MAX_INFLIGHT=${maxInflight})`);
    return {
      passed: !interrupted && failures.length === 0,
      target_rps: rate,
      duration_s: duration,
      planned,
      sent,
      dropped,
      errors,
      error_rate: errorRate,
      sent_per_second: sent / duration,
      successful_per_second: (sent - errors) / duration,
      bytes_received: bytes,
      statuses,
      network_errors: networkErrors,
      latency: summarize(latency),
      successful_latency: summarize(successLatency),
      max_scheduler_lag_ms: maxLagMs,
      endpoints,
      failures,
    };
  }

  try {
    let rateLimit = null;
    for (const url of urls) {
      const response = await request(url);
      if (response.status !== 200) throw new Error(`Pré-validação falhou em ${url.pathname}: HTTP ${response.status}.`);
      rateLimit = Number(response.headers['ratelimit-limit']) || rateLimit;
    }
    const total = rates.reduce((sum, rate) => sum + rate * duration, 0);
    console.log(`Alvos: ${rates.join(', ')} req/s, ${duration}s cada (${total} requisições no total), MAX_INFLIGHT=${maxInflight}.`);
    if (rateLimit && rateLimit < total) {
      console.log(`AVISO: a API limita a ${rateLimit} requisições por janela e por IP; o teste enviará ${total}. Espere HTTP 429 depois do limite. Para medir capacidade, suba RATE_LIMIT_MAX na API de teste e reinicie-a.`);
    }

    const results = [];
    for (const [position, rate] of rates.entries()) {
      if (interrupted) break;
      console.log(`\nEtapa ${position + 1}/${rates.length}: ${rate} req/s por ${duration}s`);
      results.push(await runStage(rate));
      if (position < rates.length - 1 && cooldown > 0) await sleep(cooldown * 1000);
    }

    console.log('\nResultado (latências consideram apenas respostas HTTP 200):\n');
    printTable(results);
    const approved = results.filter((result) => result.passed).map((result) => result.target_rps);
    console.log(`\nMaior taxa aprovada: ${approved.length ? `${Math.max(...approved)} req/s` : 'nenhuma'}`);
    console.log(`Limites: erros <= ${(errorLimit * 100).toFixed(1)}%, p95 <= ${p95Limit}ms, descartadas <= ${(droppedLimit * 100).toFixed(1)}%`);
    for (const result of results.filter((item) => !item.passed)) {
      console.log(`- ${result.target_rps} req/s: ${result.failures.join('; ') || 'interrompido'}`);
    }
    const lagged = results.filter((result) => result.max_scheduler_lag_ms > 100);
    if (lagged.length) {
      console.log(`Atenção: o gerador atrasou o agendamento em mais de 100ms em ${lagged.map((item) => `${item.target_rps} req/s (${item.max_scheduler_lag_ms.toFixed(0)}ms)`).join(', ')}; a máquina que gera a carga pode ser o gargalo.`);
    }
    if (results.some((result) => result.statuses[429])) {
      console.log('HTTP 429 indica limite por IP (RATE_LIMIT_MAX). Ajuste-o na API do ambiente de teste e reinicie-a para medir a capacidade real.');
    }
    if (resultFile) {
      await writeFile(resultFile, JSON.stringify({ model: 'open-loop', stage_seconds: duration, results }, null, 2));
      console.log(`Resultado completo em ${resultFile}`);
    }
    process.exitCode = interrupted ? 130 : results.every((result) => result.passed) ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    agent.destroy();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
