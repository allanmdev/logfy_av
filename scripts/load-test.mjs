import { createHistogram, performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

function number(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} deve estar entre ${min} e ${max}.`);
  }
  return value;
}

async function main() {
  const base = new URL(process.env.BASE_URL ?? 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) {
    throw new Error('BASE_URL deve ser uma URL HTTP sem credenciais.');
  }
  const apiKey = process.env.LOAD_API_KEY;
  if (!apiKey) throw new Error('Defina LOAD_API_KEY com uma chave que tenha routing:read.');
  const concurrency = number('CONCURRENCY', 20, 1, 1000);
  if (!Number.isInteger(concurrency)) throw new Error('CONCURRENCY deve ser inteiro.');
  const duration = number('DURATION_SECONDS', 60, 1, 3600);
  const ramp = number('RAMP_SECONDS', 10, 0, duration);
  const timeout = number('TIMEOUT_MS', 10000, 1, 120000);
  const p95Limit = number('MAX_P95_MS', 1000, 1, 120000);
  const errorLimit = number('MAX_ERROR_RATE', 0.01, 0, 1);
  const paths = (process.env.LOAD_PATHS ?? '/v1/vehicles?limit=20,/v1/route-plans?limit=20').split(',');
  const urls = paths.map((path) => {
    if (!path.startsWith('/v1/') || path.startsWith('/v1/health')) {
      throw new Error('LOAD_PATHS deve conter rotas de negócio /v1/ separadas por vírgula.');
    }
    const url = new URL(path, base);
    if (url.origin !== base.origin) throw new Error('Todas as rotas devem usar a mesma origem.');
    return url;
  });
  const controller = new AbortController();
  let interrupted = false;
  const interrupt = () => {
    interrupted = true;
    controller.abort();
  };
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const headers = { 'x-api-key': apiKey, accept: 'application/json' };
  const request = (url) => fetch(url, {
    headers,
    redirect: 'error',
    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)]),
  });
  try {
    for (const url of urls) {
      const response = await request(url);
      await response.arrayBuffer();
      if (response.status !== 200) throw new Error(`Pré-validação falhou em ${url.pathname}: HTTP ${response.status}.`);
    }
    const latency = createHistogram();
    const successLatency = createHistogram();
    const statuses = {};
    const networkErrors = {};
    const endpoints = Object.fromEntries(paths.map((path) => [path, { requests: 0, errors: 0 }]));
    let requests = 0;
    let errors = 0;
    let bytes = 0;
    let sequence = 0;
    const started = performance.now();
    const deadline = started + duration * 1000;
    const progress = setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      console.log(JSON.stringify({ elapsed_s: Math.round(elapsed), requests, errors, rps: Number((requests / elapsed).toFixed(2)) }));
    }, 5000);
    try {
      await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
        try {
          await sleep(ramp * 1000 * worker / concurrency, undefined, { signal: controller.signal });
        } catch {
          return;
        }
        while (!interrupted && performance.now() < deadline) {
          const index = sequence++ % urls.length;
          const endpoint = endpoints[paths[index]];
          const start = performance.now();
          let ok = false;
          try {
            const response = await request(urls[index]);
            bytes += (await response.arrayBuffer()).byteLength;
            statuses[response.status] = (statuses[response.status] ?? 0) + 1;
            ok = response.status === 200;
          } catch (error) {
            const kind = error.name ?? 'Error';
            networkErrors[kind] = (networkErrors[kind] ?? 0) + 1;
          }
          const elapsedUs = Math.max(1, Math.round((performance.now() - start) * 1000));
          latency.record(elapsedUs);
          if (ok) successLatency.record(elapsedUs);
          requests++;
          endpoint.requests++;
          if (!ok) {
            errors++;
            endpoint.errors++;
          }
        }
      }));
    } finally {
      clearInterval(progress);
    }
    const seconds = (performance.now() - started) / 1000;
    const errorRate = requests ? errors / requests : 1;
    const summarize = (histogram) => histogram.count ? {
      p50_ms: histogram.percentile(50) / 1000,
      p95_ms: histogram.percentile(95) / 1000,
      p99_ms: histogram.percentile(99) / 1000,
      max_ms: histogram.max / 1000,
    } : null;
    const passed = !interrupted && requests > 0 && successLatency.count > 0 && errorRate <= errorLimit && successLatency.percentile(95) / 1000 <= p95Limit;
    console.log(JSON.stringify({
      passed,
      interrupted,
      model: 'closed-loop',
      concurrency,
      duration_s: Number(seconds.toFixed(2)),
      ramp_s: ramp,
      requests,
      successes: requests - errors,
      errors,
      error_rate: errorRate,
      requests_per_second: requests / seconds,
      successful_requests_per_second: (requests - errors) / seconds,
      bytes_received: bytes,
      statuses,
      network_errors: networkErrors,
      latency: summarize(latency),
      successful_latency: summarize(successLatency),
      thresholds: { max_error_rate: errorLimit, max_successful_p95_ms: p95Limit },
      endpoints,
      rate_limit_warning: statuses[429] ? 'HTTP 429 indica limite por IP. Para medir capacidade, ajuste RATE_LIMIT_MAX na API do ambiente de teste e reinicie-a.' : null,
    }, null, 2));
    process.exitCode = interrupted ? 130 : passed ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
