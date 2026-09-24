import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

async function main() {
  const source = process.env.DATABASE_URL;
  if (!source)
    throw new Error('DATABASE_URL is required for integration tests.');
  const name = `logfy_test_${randomBytes(8).toString('hex')}`;
  const url = new URL(source);
  url.pathname = `/${name}`;
  const client = new Client({ connectionString: source });
  await client.connect();
  let created = false;
  try {
    await client.query(`CREATE DATABASE "${name}"`);
    created = true;
    const env = {
      ...process.env,
      DATABASE_URL: url.toString(),
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      ADMIN_API_KEY: randomBytes(32).toString('hex'),
      LOGFY_INTEGRATION_DATABASE: name,
    };
    const migration = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      env,
      stdio: 'inherit',
    });
    if (migration.status !== 0)
      throw new Error('Test database migrations failed.');
    const result = spawnSync(
      'npx',
      ['tsx', '--test', 'tests/integration/routing.test.ts'],
      { env, stdio: 'inherit' },
    );
    process.exitCode = result.status ?? 1;
  } finally {
    if (created) await client.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Integration tests failed.',
  );
  process.exitCode = 1;
});
