/**
 * @deprecated — use `src/modules/email/queue` deep module. This file remains for backward compat and `pnpm worker` script.
 * Previously: bare `new Queue('emailQueue')` with no connection. Now delegates to deep queue with explicit lifecycle.
 */
import { getEmailQueue, closeEmailQueue, enqueueEmail } from '../modules/email/queue';

export const emailQueue = (getEmailQueue() as any) || ({ add: async () => ({ id: null }), close: async () => {} } as any);
export const closeQueue = closeEmailQueue;
export { enqueueEmail };
