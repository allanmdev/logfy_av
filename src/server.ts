import { createApp } from './app';
import { env } from './config/env';
import { logger } from './shared/logger/logger';
import { prisma } from './shared/database/prisma';
import { redis } from './shared/redis/redis';

async function main(): Promise<void> {
  await Promise.all([prisma.$connect(), redis.connect()]);
  const server = createApp().listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API Logfy iniciada');
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  let stopping = false;

  const shutdown = (signal: string, exitCode = 0): void => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Encerrando servidor Logfy');
    const deadline = setTimeout(() => {
      server.closeAllConnections();
      redis.disconnect();
      process.exit(1);
    }, 10000);
    deadline.unref();
    server.close(async (error) => {
      const results = await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
      redis.disconnect();
      clearTimeout(deadline);
      process.exitCode = error || results.some((result) => result.status === 'rejected') ? 1 : exitCode;
    });
  };
  server.on('error', () => shutdown('server-error', 1));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch(async () => {
  logger.fatal('Failed to initialize API dependencies');
  redis.disconnect();
  await prisma.$disconnect();
  process.exitCode = 1;
});
