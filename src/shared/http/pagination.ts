import { z } from 'zod';

export const paginationSchema = z
  .object({
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(z.number().int().max(2147483647))
      .default(1),
    limit: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(z.number().int().max(100))
      .default(20),
  })
  .refine((value) => (value.page - 1) * value.limit <= 2147483647, {
    message: 'Pagination offset is too large.',
  });
