export interface LogMeta {
  [key: string]: any;
}

export const logger = {
  info: (message: string, meta?: LogMeta) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), service: 'payment-service', level: 'info', message, ...meta }));
  },
  warn: (message: string, meta?: LogMeta) => {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), service: 'payment-service', level: 'warn', message, ...meta }));
  },
  error: (message: string, meta?: LogMeta) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), service: 'payment-service', level: 'error', message, ...meta }));
  },
};
