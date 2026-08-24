/**
 * Deep email worker — hides job processing, retry, Resend SDK.
 * Previously: queues/workers.ts stub `console.log(job.data)` separate `pnpm worker` script, not wired to app.
 * Now: managed Worker with explicit connection, lifecycle, error handling, shared with queue module.
 */
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../../logger/winston.logger';
import { Resend } from 'resend';
import type { EmailJob } from './types';

let worker: Worker<EmailJob> | null = null;
let workerConnection: IORedis | null = null;

function getWorkerConnection(): IORedis | null {
  if (workerConnection) return workerConnection;
  if (!process.env.REDIS_URL) return null;
  workerConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  return workerConnection;
}

export function startEmailWorker(opts: { resendApiKey: string; from: string }): Worker<EmailJob> | null {
  if (worker) return worker;
  const conn = getWorkerConnection();
  if (!conn) {
    logger.warn('REDIS_URL not configured — email worker disabled');
    return null;
  }
  if (!opts.resendApiKey || !opts.from) {
    logger.warn('Resend not configured — email worker disabled');
    return null;
  }

  const resend = new Resend(opts.resendApiKey);

  worker = new Worker<EmailJob>(
    'emailQueue',
    async (job: Job<EmailJob>) => {
      const { to, subject, html, text } = job.data;
      logger.info('Email worker processing', { id: job.id, to, subject });
      const response = await resend.emails.send({ from: opts.from, to, subject, html, text });
      if (response.error) {
        logger.error('Worker email send failed', { id: job.id, error: response.error });
        throw new Error(`Email delivery failed: ${response.error.message}`);
      }
      logger.info('Worker email sent', { id: job.id, messageId: response.data?.id });
      return { id: response.data?.id };
    },
    { connection: conn as any, concurrency: 5, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } }
  );

  worker.on('completed', job => logger.info('Email job completed', { id: job.id }));
  worker.on('failed', (job, err) => logger.error('Email job failed', { id: job?.id, error: err.message }));
  worker.on('error', err => logger.error('Email worker error', { error: err.message }));

  logger.info('Email worker started');
  return worker;
}

export async function closeEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
  }
}
