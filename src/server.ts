import app from './app';
import { env } from './config/env';
import logger from './logger/winston.logger';
import { bootstrap } from './bootstrap';

async function start() {
  try {
    await bootstrap();
  } catch (e) {
    logger.warn('Bootstrap warning', { error: e instanceof Error ? e.message : e });
  }
  app.listen(env.PORT, () => {
    logger.info(`Auth service running on port http://localhost:${env.PORT}`);
  });
}

start();
