import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const env = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://logfy:logfy@127.0.0.1:5432/logfy_unit?schema=public',
};

export default defineConfig({
  test: {
    env,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
