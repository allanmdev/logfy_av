import pino from 'pino';

import { env } from '../../config/env';

const isDevelopment = env.NODE_ENV === 'development';

export const logger = pino({
  name: 'logfy-api',

  level: env.LOG_LEVEL,

  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.url?.split('?')[0], remoteAddress: req.remoteAddress };
    },
  },

  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'req.headers["x-api-key"]',
      'req.headers["x-admin-key"]',
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
