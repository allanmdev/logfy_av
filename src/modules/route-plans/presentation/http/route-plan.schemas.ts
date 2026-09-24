import { z } from 'zod';
import { paginationSchema } from '../../../../shared/http/pagination';

const fields = z
  .object({
    name: z.string().trim().min(1).max(150),
    depotLatitude: z.number().min(-90).max(90),
    depotLongitude: z.number().min(-180).max(180),
  })
  .strict();
const params = z.object({ id: z.string().cuid() });

export const createRoutePlanSchema = z.object({ body: fields });
export const updateRoutePlanSchema = z.object({
  params,
  body: fields.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  }),
});
export const getRoutePlanSchema = z.object({ params });
export const listRoutePlanSchema = z.object({ query: paginationSchema });
