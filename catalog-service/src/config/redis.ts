// import Redis from 'ioredis';
// MOCKED REDIS to disable Redis during local development
console.log('🚀 MOCKED Redis Connected successfully (Cache Disabled)');

const redis = {
  get: async (key: string) => null,
  set: async (key: string, value: string, mode: string, duration: number) => 'OK',
  keys: async (pattern: string) => [],
  del: async (...keys: string[]) => 1
};

export const getCache = async (key: string): Promise<string | null> => null;

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {};

export const deleteCache = async (pattern: string): Promise<void> => {};

export default redis as any;
