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