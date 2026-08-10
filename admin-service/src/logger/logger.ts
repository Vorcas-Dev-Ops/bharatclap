import { AppConfig } from '../config/app.config';

export class Logger {
  static info(message: string, meta?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      service: AppConfig.SERVICE_NAME,
      message,
      meta,
    }));
  }

  static warn(message: string, meta?: any) {
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'WARN',
      service: AppConfig.SERVICE_NAME,
      message,
      meta,
    }));
  }

  static error(message: string, meta?: any) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      service: AppConfig.SERVICE_NAME,
      message,
      meta,
    }));
  }
}
