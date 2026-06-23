import { Worker } from 'bullmq';
import { redisConnectionOptions } from '../config/queue';

export const notificationWorker = new Worker(
  'notifications',
  async (job) => {
    console.log(`[WORKER] Processing job ${job.id} of type ${job.name}`);
    
    // Simulate background operations like sending an email or push notification
    if (job.name === 'send-email' || job.name === 'enqueueNotification' || job.data?.type) {
      const { type, recipient, title, body } = job.data;
      console.log(`[WORKER] Dispatching ${type || 'alert'} to ${recipient || 'system'}... Done.`);
      
      // In production, integration with Resend, SendGrid, Twilio, Firebase, etc. goes here
    }
  },
  {
    connection: redisConnectionOptions
  }
);

notificationWorker.on('completed', (job) => {
  console.log(`[WORKER] Job ${job.id} completed successfully`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`[WORKER] Job ${job?.id} failed with error:`, err);
});
