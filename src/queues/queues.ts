import { Queue } from 'bullmq';

export const emailQueue = new Queue('emailQueue');
