import { z } from 'zod';

export const optimizeRoutePlanSchema = z.object({
  params: z.object({ id: z.string().cuid() }),
  body: z
    .object({
      vehicleIds: z
        .array(z.string().cuid())
        .min(1)
        .max(100)
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'Vehicle IDs must be unique.',
        }),
    })
    .strict(),
});
