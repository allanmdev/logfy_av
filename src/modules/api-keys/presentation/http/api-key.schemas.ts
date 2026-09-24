import { z } from 'zod';

import { SCOPES } from '../../../../shared/auth/scopes';

const accountIdParams = z.object({
  accountId: z.string().cuid(),
});

export const createApiKeySchema = z.object({
  params: accountIdParams,

  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(150),

    scopes: z
      .array(z.enum(SCOPES))
      .min(1),

    expiresAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .refine(
        (value) => value.getTime() > Date.now(),
        {
          message: 'Expiration date must be in the future.',
        },
      )
      .nullable()
      .optional(),
  }),
});

export const listApiKeysSchema = z.object({
  params: accountIdParams,
});

export const revokeApiKeySchema = z.object({
  params: accountIdParams.extend({
    apiKeyId: z.string().cuid(),
  }),
});
