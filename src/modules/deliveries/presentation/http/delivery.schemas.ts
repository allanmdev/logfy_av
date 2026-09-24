import { z } from 'zod';
import { paginationSchema } from '../../../../shared/http/pagination';

const fields = z
  .object({
    reference: z.string().trim().min(1).max(150),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    demand: z.number().int().positive().max(2147483647),
    serviceDurationSeconds: z.number().int().min(0).max(86400),
  })
  .strict();
const params = z.object({
  id: z.string().cuid(),
  routePlanId: z.string().cuid(),
});

export const createDeliverySchema = z.object({
  params: z.object({ routePlanId: z.string().cuid() }),
  body: fields.extend({
    serviceDurationSeconds: fields.shape.serviceDurationSeconds.default(0),
  }),
});
export const updateDeliverySchema = z.object({
  params,
  body: fields.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  }),
});
export const getDeliverySchema = z.object({ params });
export const listDeliverySchema = z.object({
  params: z.object({ routePlanId: z.string().cuid() }),
  query: paginationSchema,
});
