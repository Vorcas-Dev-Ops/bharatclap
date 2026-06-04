import Queue from 'bull';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

console.log(`[BULL-QUEUE] Connecting to Redis at ${redisUrl}...`);

export const notificationQueue = new Queue('notification-dispatch', redisUrl, {
  defaultJobOptions: {
    attempts: 3,                 // Retry 3 times on failure
    backoff: {
      type: 'exponential',       // Wait exponentially between retries
      delay: 5000                // Wait 5s, then 10s, then 20s...
    },
    removeOnComplete: true,      // Automatically remove finished jobs to preserve memory
    removeOnFail: false          // Keep failed jobs for diagnostic inspection
  }
});

// Register the background Queue Worker Processor
notificationQueue.process(async (job) => {
  const { type, recipient, title, body, metadata } = job.data;
  
  console.log(`[BULL-QUEUE-WORKER] 🛠️ Processing background job #${job.id} [Type: ${type}]`);
  
  if (type === 'email') {
    // Simulate real-world SMTP/Nodemailer network dispatch overhead (1.5 seconds delay)
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log(`✉️ [ASYNC-MAIL] Email successfully dispatched to: ${recipient} | Subject: "${title}"`);
    return { success: true, channel: 'email', recipient };
  } 
  
  if (type === 'sms') {
    // Simulate Twilio SMS gateway dispatch overhead (1 second delay)
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`📱 [ASYNC-SMS] SMS OTP successfully dispatched to: ${recipient}`);
    return { success: true, channel: 'sms', recipient };
  }
  
  console.warn(`⚠️ [BULL-QUEUE-WORKER] Unknown notification channel type: "${type}"`);
  throw new Error(`Unsupported channel type: ${type}`);
});

// Event listeners for reporting
notificationQueue.on('completed', (job, result) => {
  console.log(`[BULL-QUEUE] ✅ Job #${job.id} completed successfully! Result:`, result);
});

notificationQueue.on('failed', (job, err) => {
  console.error(`[BULL-QUEUE] ❌ Job #${job.id} failed! Error: ${err.message}. Retrying if attempts remain...`);
});
