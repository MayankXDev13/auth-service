import { Worker } from 'bullmq';
import logger from '../logger/winston.logger';

export const emailWorker = new Worker('emailQueue', async job => {
  logger.info(`Email worker started for job ${job.id}`);
  logger.info(`Processing job ${job.id}`);

  //add login read the email Queue and send the email
  console.log(job.data);
});
