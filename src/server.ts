import app from './app';
import { env } from './config/env';
import logger from './logger/winston.logger';

app.listen(env.PORT, () => {
  logger.info(`Auth service running on port http://localhost:${env.PORT}`);
});
