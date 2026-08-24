/**
 * @deprecated — use `src/modules/email/worker` deep module. Retained for `pnpm worker` backward compat.
 */
import { startEmailWorker, closeEmailWorker } from '../modules/email/worker';
import { env } from '../config/env';

export const emailWorker = process.env.REDIS_URL && env.RESEND_API_KEY
  ? (startEmailWorker({ resendApiKey: env.RESEND_API_KEY, from: env.RESEND_FROM_EMAIL }) as any)
  : (null as any);

export const closeWorker = closeEmailWorker;
