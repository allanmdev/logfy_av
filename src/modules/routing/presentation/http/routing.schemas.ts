import { z } from 'zod';

export const optimizeRoutePlanSchema = z.object({
  params: z.object({ id: z.uuid() }),
  body: z
    .object({
      vehicleIds: z
        .array(z.uuid())
        .min(1)
        .max(100)
        .refine((ids) => new Set(ids).size === ids.length, {
          message: 'Vehicle IDs must be unique.',
        }),
      fuelConsumptionKmPerLiter: z.number().positive().max(1000).default(10),
    })
    .strict(),
});
