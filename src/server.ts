import { createApp } from './app';
import { env } from './config/env';
import { logger } from './shared/logger/logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
    },
    'API Logfy iniciada',
  );
});

function shutdown(signal: string): void {
  logger.info(
    {
      signal,
    },
    'Encerrando servidor Logfy',
  );

  server.close((error) => {
    if (error) {
      logger.error(
        {
          err: error,
        },
        'Erro ao encerrar o servidor Logfy',
      );

      process.exit(1);
    }

    logger.info('HTTP server closed');

    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));