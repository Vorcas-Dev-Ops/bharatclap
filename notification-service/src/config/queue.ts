// import Queue from 'bull';
// MOCKED QUEUE to disable Redis during local development
console.log(`[BULL-QUEUE] MOCKED: Redis is disabled locally.`);

export const notificationQueue = {
  add: async (data: any, opts?: any) => {
    console.log(`[MOCK-QUEUE] Job added:`, data);
    return { id: Math.random().toString() };
  },
  process: (cb: any) => {
    console.log(`[MOCK-QUEUE] Worker registered (Jobs won't actually be processed async).`);
  },
  on: (event: string, cb: any) => {}
} as any;

