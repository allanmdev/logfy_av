import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { apiRouter } from './shared/http/routes';
import { errorHandler } from './shared/http/middlewares/error-handler';
import { notFound } from './shared/http/middlewares/not-found';
import { requestId } from './shared/http/middlewares/request-id';
import { logger } from './shared/logger/logger';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  app.use(helmet());

  app.use(
    cors({
      origin: false,
    }),
  );

  app.use(compression());

  app.use(
    express.json({
      limit: '1mb',
    }),
  );

  app.use(requestId);

  app.use(
    pinoHttp({
      logger,

      customProps(req) {
        return {
          requestId: req.headers['x-request-id'],
        };
      },
    }),
  );

  app.use('/v1', apiRouter);

  app.use(notFound);

  app.use(errorHandler);

  return app;
}