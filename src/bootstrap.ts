import { env } from './config/env';
import { createAuth } from './modules/auth';
import { initRedis, closeRedis } from './lib/redis';
import logger from './logger/winston.logger';
import { pool } from './config/db';
import { startEmailWorker, closeEmailWorker } from './modules/email/worker';
import { closeEmailQueue } from './modules/email/queue';
import { QueuedEmailAdapter } from './modules/auth/adapters/queuedEmailAdapter';
import passport from 'passport';
import { createPassportStrategies } from './modules/auth/passport/factory';
import { DrizzleUserRepository } from './modules/auth/adapters/drizzleUserRepository';
import { db } from './config/db';
import bcrypt from 'bcrypt';
import { posthog as posthogInstance } from './lib/posthog';

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) throw new Error('Auth not initialized — call bootstrap() first');
  return authInstance;
}

export async function bootstrap() {
  // single source of truth for env already validated by config/env.ts
  // init Redis lifecycle (fixes server.ts never calling initRedis)
  initRedis();

  // create deep auth domain with explicit lifecycle — queued email when REDIS_URL present (non-blocking HTTP)
  const emailAdapter = process.env.REDIS_URL
    ? new QueuedEmailAdapter({ apiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL })
    : undefined; // createAuth will fallback to ResendEmailAdapter or InMemory

  authInstance = createAuth({
    email: emailAdapter,
    config: {
      accessTokenSecret: env.ACCESS_TOKEN_SECRET,
      refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
      accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
      refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
      clientSsoRedirectUrl: env.CLIENT_SSO_REDIRECT_URL,
      forgotPasswordRedirectUrl: env.FORGOT_PASSWORD_REDIRECT_URL,
      s3Bucket: env.S3_BUCKET,
      s3Region: env.AWS_REGION,
      s3ProfilePicsPrefix: env.S3_PROFILE_PICS_PREFIX,
      resendFromEmail: env.RESEND_FROM_EMAIL,
    },
  });

  try {
    await authInstance.init();
    logger.info('Auth domain initialized');
  } catch (e) {
    logger.warn('Auth domain init failed', { error: e instanceof Error ? e.message : e });
  }

  // init passport via deep factory (explicit, testable, deduplicates OAuth) — replaces side-effect import
  try {
    const users = new DrizzleUserRepository(db as any);
    const analytics = {
      capture: (ev: { distinctId: string; event: string; properties?: Record<string, unknown> }) =>
        (posthogInstance as any)?.capture?.({ distinctId: ev.distinctId, event: ev.event, properties: ev.properties }),
    };
    createPassportStrategies({
      passport,
      users: users as any,
      config: {
        accessTokenSecret: env.ACCESS_TOKEN_SECRET,
        refreshTokenSecret: env.REFRESH_TOKEN_SECRET,
        accessTokenExpiry: env.ACCESS_TOKEN_EXPIRY,
        refreshTokenExpiry: env.REFRESH_TOKEN_EXPIRY,
        clientSsoRedirectUrl: env.CLIENT_SSO_REDIRECT_URL,
        forgotPasswordRedirectUrl: env.FORGOT_PASSWORD_REDIRECT_URL,
        s3Bucket: env.S3_BUCKET,
        s3Region: env.AWS_REGION,
        s3ProfilePicsPrefix: env.S3_PROFILE_PICS_PREFIX,
        resendFromEmail: env.RESEND_FROM_EMAIL,
      },
      analytics: analytics as any,
      hasher: { hash: (pw: string) => bcrypt.hash(pw, 12), compare: bcrypt.compare },
      env,
    });
    logger.info('Passport strategies initialized via factory');
  } catch (e) {
    logger.warn('Passport factory init failed', { error: e instanceof Error ? e.message : e });
  }

  // start email worker in same process when queue enabled (previously separate `pnpm worker` disconnected)
  if (process.env.REDIS_URL && env.RESEND_API_KEY) {
    startEmailWorker({ resendApiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL });
  }

  // graceful shutdown — fixes queue/analytics/posthog flush missing
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    try {
      if (authInstance) await authInstance.close();
      await closeEmailWorker();
      await closeEmailQueue();
      await closeRedis();
      await pool.end();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    } catch (e) {
      logger.error('Shutdown error', { error: e });
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return authInstance;
}
