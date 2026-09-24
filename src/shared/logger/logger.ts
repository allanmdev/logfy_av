import pino from 'pino';

import { env } from '../../config/env';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  name: 'logfy-api',

  level: env.LOG_LEVEL,

  redact: {
    paths: [
      'req.headers.authorization',
      'apiKey',
      'password',
      'token',
      'secret',
    ],
    censor: '[REDACTED]',
  },

  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:dd/mm/yyyy HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      }
    : undefined,
});