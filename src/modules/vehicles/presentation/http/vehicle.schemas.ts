import { z } from 'zod';
import { paginationSchema } from '../../../../shared/http/pagination';

const fields = z
  .object({
    name: z.string().trim().min(1).max(150),
    capacity: z.number().int().positive().max(2147483647),
    active: z.boolean(),
  })
  .strict();
const params = z.object({ id: z.string().cuid() });

export const createVehicleSchema = z.object({
  body: fields.extend({ active: z.boolean().default(true) }),
});
export const updateVehicleSchema = z.object({
  params,
  body: fields.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  }),
});
export const getVehicleSchema = z.object({ params });
export const listVehicleSchema = z.object({ query: paginationSchema });
