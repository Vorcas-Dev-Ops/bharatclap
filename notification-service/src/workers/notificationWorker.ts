import { redisConnectionOptions, isQueueReady } from '../config/queue';

let _worker: any = null;

const initWorker = async () => {
  // Wait briefly for the queue init to settle
  await new Promise(r => setTimeout(r, 2000));

  if (!isQueueReady()) {
    console.log('[WORKER] Redis unavailable — notification worker not started (queue in fallback mode).');
    return;
  }

  try {
    const { Worker } = await import('bullmq');

    _worker = new Worker(
      'notifications',
      async (job: any) => {
        console.log(`[WORKER] Processing job ${job.id} of type ${job.name}`);

        if (job.name === 'send-email' || job.name === 'enqueueNotification' || job.data?.type) {
          const { type, recipient, title, body } = job.data;
          console.log(`[WORKER] Dispatching ${type || 'alert'} to ${recipient || 'system'}... Done.`);
          // In production: integrate with Resend, SendGrid, Twilio, Firebase, etc.
        }
      },
      { connection: redisConnectionOptions }
    );

    _worker.on('completed', (job: any) => {
      console.log(`[WORKER] Job ${job.id} completed successfully`);
    });

    _worker.on('failed', (job: any, err: Error) => {
      console.error(`[WORKER] Job ${job?.id} failed with error:`, err);
    });

    console.log('[WORKER] Notification worker started successfully.');
  } catch (err: any) {
    console.warn(`[WORKER] Could not start notification worker: ${err.message}`);
  }
};

initWorker().catch(() => {});

export const getWorker = () => _worker;
