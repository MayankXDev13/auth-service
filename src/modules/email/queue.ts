/**
 * Deep email queue — hides BullMQ + Redis connection + retry policy.
 * Previously: queues/queues.ts 3 LoC bare `new Queue('emailQueue')` with no connection (implicit localhost:6379),
 * queues/workers.ts 10 LoC console.log stub, not wired to app lifecycle.
 * Now: single Queue factory with explicit connection, job schema, retry, lifecycle hooks.
 *
 * Dependency: 2. Local-substitutable (BullMQ/Redis → real IORedis in prod, in-memory array in test via QueuedEmailAdapter injection).
 */
import { Queue, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import logger from '../../logger/winston.logger';
import type { EmailJob } from './types';

let queue: Queue<EmailJob> | null = null;
let connection: IORedis | null = null;

function getConnection(): IORedis | null {
  if (connection) return connection;
  if (!process.env.REDIS_URL) return null;
  connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  connection.on('error', err => logger.error('Email queue Redis error', { error: err.message }));
  connection.on('ready', () => logger.info('Email queue Redis ready'));
  return connection;
}

export function getEmailQueue(): Queue<EmailJob> | null {
  if (queue) return queue;
  const conn = getConnection();
  if (!conn) {
    logger.warn('REDIS_URL not configured — email queue disabled, falling back to direct send');
    return null;
  }
  const opts: QueueOptions = {
    connection: conn as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  };
  queue = new Queue<EmailJob>('emailQueue', opts);
  queue.on('error', err => logger.error('Email queue error', { error: err.message }));
  return queue;
}

export async function enqueueEmail(job: EmailJob): Promise<{ id: string } | null> {
  const q = getEmailQueue();
  if (!q) return null;
  const bullJob = await q.add('sendEmail', job, { jobId: undefined });
  logger.info('Email enqueued', { id: bullJob.id, to: job.to, subject: job.subject });
  return { id: bullJob.id! };
}

export async function closeEmailQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
