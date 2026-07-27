export interface LogMeta {
  [key: string]: any;
}

export const logger = {
  info: (message: string, meta?: LogMeta) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message, ...meta }));
  },
  warn: (message: string, meta?: LogMeta) => {
    console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'warn', message, ...meta }));
  },
  error: (message: string, meta?: LogMeta) => {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message, ...meta }));
  },
};
