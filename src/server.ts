import app from "./app";
import { env } from "./config/env";
import { pool } from "./config/db";
import logger from "./logger/winston.logger";

const server = app.listen(env.PORT, () => {
  logger.info(`Auth service running on port http://localhost:${env.PORT}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info("HTTP server closed.");
    
    try {
      await pool.end();
      logger.info("Database pool closed.");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error });
      process.exit(1);
    }
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
