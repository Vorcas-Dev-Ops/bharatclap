import nodemailer from 'nodemailer';
import { redisConnectionOptions, isQueueReady } from '../config/queue';
import { providerWelcomeEmail } from '../utils/emailTemplates';

// ─── Nodemailer transporter ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const SMTP_READY = !!(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD);
const PLATFORM_NAME = process.env.PLATFORM_NAME || 'BharatClap';

// ─── Email sender helper ────────────────────────────────────────────────────────
const sendEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!SMTP_READY) {
    console.log(`[WORKER][MOCK EMAIL] SMTP not configured. Would send "${subject}" to ${to}`);
    return;
  }
  await transporter.sendMail({
    from: `"${PLATFORM_NAME}" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html,
  });
  console.log(`[WORKER] Email "${subject}" sent to ${to}`);
};

// ─── Job handler ────────────────────────────────────────────────────────────────
const processJob = async (job: any): Promise<void> => {
  const { type, recipient, title, body, metadata = {} } = job.data;

  console.log(`[WORKER] Processing job ${job.id} | type=${type} | recipient=${recipient}`);

  switch (type) {
    // ── Provider welcome onboarding email ──────────────────────────────────────
    case 'provider_welcome': {
      const providerName = metadata.providerName || 'Provider';
      const html = providerWelcomeEmail(providerName);
      await sendEmail(
        recipient,
        `Welcome to ${PLATFORM_NAME} — Your Registration is Confirmed!`,
        html
      );
      break;
    }

    // ── Generic email ──────────────────────────────────────────────────────────
    case 'email': {
      if (!recipient) {
        console.warn(`[WORKER] Job ${job.id}: email type but no recipient provided.`);
        break;
      }
      const html = body || `<p>${title || 'Notification from ' + PLATFORM_NAME}</p>`;
      await sendEmail(recipient, title || `${PLATFORM_NAME} Notification`, html);
      break;
    }

    // ── SMS (stub — integrate Twilio/Fast2SMS in production) ───────────────────
    case 'sms': {
      console.log(`[WORKER][MOCK SMS] Would send SMS to ${recipient}: ${body}`);
      break;
    }

    // ── Push notification via FCM ─────────────────────────────────────────────
    case 'push':
    case 'fcm': {
      const { fcmService } = await import('../services/fcmService');
      const token = metadata.fcmToken || recipient;
      await fcmService.sendPushNotification({
        token,
        title: title || `${PLATFORM_NAME} Notification`,
        body: body || '',
        data: metadata,
      });
      break;
    }

    default:
      console.log(`[WORKER] Unknown notification type "${type}" for job ${job.id}. Skipping.`);
  }
};

// ─── Worker initialisation ──────────────────────────────────────────────────────
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

    _worker = new Worker('notifications', processJob, {
      connection: redisConnectionOptions,
    });

    _worker.on('completed', (job: any) => {
      console.log(`[WORKER] Job ${job.id} completed successfully`);
    });

    _worker.on('failed', (job: any, err: Error) => {
      console.error(`[WORKER] Job ${job?.id} failed:`, err.message);
    });

    console.log('[WORKER] Notification worker started successfully.');
  } catch (err: any) {
    console.warn(`[WORKER] Could not start notification worker: ${err.message}`);
  }
};

initWorker().catch(() => {});

export const getWorker = () => _worker;
