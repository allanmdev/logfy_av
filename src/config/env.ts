import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3000),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),

  REDIS_URL: z.url().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)).default('redis://127.0.0.1:6379'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  CORS_ORIGINS: z.string().default(''),
  TRUST_PROXY: z.string().default(''),

  ADMIN_API_KEY: z.string().min(32).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  GOOGLE_MAPS_TIMEOUT_MS: z.coerce.number().int().min(100).max(120000).default(10000),
  ROUTING_MAX_DELIVERIES: z.coerce.number().int().min(1).max(500).default(100),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    'Invalid environment variables:',
    parsed.error.flatten().fieldErrors,
  );

  process.exit(1);
}

export const env = parsed.data;
