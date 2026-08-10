// ponytail: Single-file lifecycle helper combining graceful shutdown, signal handling, readiness state, and bounded retries.
import { Server } from 'http';

export interface LifecycleOptions {
  serviceName: string;
  port: number;
  server: Server;
  mongoose?: any;
  socketIO?: any;
  queues?: any[];
  intervals?: (NodeJS.Timeout | null)[];
  maxRetries?: number;
}

let isReady = true;
export const isServiceReady = () => isReady;

export function setupLifecycle(options: LifecycleOptions) {
  const {
    serviceName,
    port,
    server,
    mongoose,
    socketIO,
    queues = [],
    intervals = [],
    maxRetries = 5,
  } = options;

  if ((server as any)._lifecycleSetupDone) {
    return;
  }
  (server as any)._lifecycleSetupDone = true;

  let isShuttingDown = false;
  let retryCount = 0;

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE' && !isShuttingDown) {
      retryCount++;
      if (retryCount <= maxRetries) {
        console.warn(`[${serviceName}] Port ${port} already in use, retrying in 1s (attempt ${retryCount}/${maxRetries})...`);
        setTimeout(() => {
          if (!isShuttingDown) {
            if (server.listening) {
              server.close(() => {
                try { server.listen(port, '0.0.0.0'); } catch {}
              });
            } else {
              try { server.listen(port, '0.0.0.0'); } catch {}
            }
          }
        }, 1000);
      } else {
        console.error(`[${serviceName}] ❌ Port ${port} is occupied after ${maxRetries} attempts. Startup failed.`);
        process.exit(1);
      }
    } else {
      console.error(`[${serviceName}] ❌ Server error:`, err);
    }
  });

  const gracefulShutdown = (signal: string): Promise<void> => {
    return new Promise((resolve) => {
      if (isShuttingDown) return resolve();
      isShuttingDown = true;
      isReady = false;

      console.log(`[${serviceName}] Shutdown initiated (signal: ${signal})`);

      intervals.forEach((timer) => timer && clearInterval(timer));

      if (typeof (server as any).closeIdleConnections === 'function') {
        (server as any).closeIdleConnections();
      }
      if (typeof (server as any).closeAllConnections === 'function') {
        (server as any).closeAllConnections();
      }

      if (socketIO) {
        try {
          socketIO.close();
          console.log(`[${serviceName}] Socket.IO server closed`);
        } catch {}
      }

      if (server.listening) {
        server.close(async () => {
          console.log(`[${serviceName}] HTTP server closed`);

          for (const q of queues) {
            if (q && typeof q.close === 'function') {
              try { await q.close(); } catch {}
            }
          }

          if (mongoose?.connection) {
            try {
              await mongoose.connection.close();
              console.log(`[${serviceName}] Database connection closed`);
            } catch (err: any) {
              console.error(`[${serviceName}] Error closing DB:`, err?.message);
            }
          }

          console.log(`[${serviceName}] Shutdown complete`);
          resolve();
        });
      } else {
        resolve();
      }

      setTimeout(() => {
        console.error(`[${serviceName}] ⚠️ Force exit triggered after timeout`);
        process.exit(1);
      }, 5000).unref();
    });
  };

  process.once('SIGINT', async () => {
    await gracefulShutdown('SIGINT');
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    await gracefulShutdown('SIGTERM');
    process.exit(0);
  });

  process.once('SIGUSR2', async () => {
    await gracefulShutdown('SIGUSR2');
    process.kill(process.pid, 'SIGUSR2');
  });

  process.on('uncaughtException', async (err) => {
    console.error(`[${serviceName}] ❌ Uncaught Exception:`, err);
    await gracefulShutdown('uncaughtException');
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    console.error(`[${serviceName}] ❌ Unhandled Rejection:`, reason);
    await gracefulShutdown('unhandledRejection');
    process.exit(1);
  });
}
