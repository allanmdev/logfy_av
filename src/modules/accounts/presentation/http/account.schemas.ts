import { z } from 'zod';
import { AccountStatus } from '../../domain/entities/account.entity';

const accountIdParams = z.object({
  id: z.string().cuid(),
});

const statusToDomain = {
  ACTIVE: AccountStatus.ACTIVE,
  SUSPENDED: AccountStatus.SUSPENDED,
  INACTIVE: AccountStatus.INACTIVE,
};

const accountStatus = z.enum([
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
]).transform((status) => statusToDomain[status]);

export const createAccountSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      ),
  }),
});

export const getAccountSchema = z.object({
  params: accountIdParams,
});

export const updateAccountSchema = z.object({
  params: accountIdParams,

  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      ),

    status: accountStatus,
  }),
});

export const patchAccountSchema = z.object({
  params: accountIdParams,

  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2)
        .max(150)
        .optional(),

      slug: z
        .string()
        .trim()
        .min(2)
        .max(100)
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        )
        .optional(),

      status: accountStatus.optional(),
    })
    .refine(
      (data) =>
        Object.keys(data).length > 0,
      {
        message:
          'At least one field must be provided.',
      },
    ),
});

export const deleteAccountSchema = z.object({
  params: accountIdParams,
});

export const listAccountsQuerySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().max(2147483647)).default(1),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number)
    .pipe(z.number().int().max(100)).default(20),
  deleted: z.enum(['all', 'true', 'false']).default('all'),
}).refine((query) => (query.page - 1) * query.limit <= 2147483647, {
  message: 'Pagination offset is too large.',
  path: ['page'],
});

export const listAccountsSchema = z.object({
  query: listAccountsQuerySchema,
});
