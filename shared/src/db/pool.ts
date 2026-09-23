import { Pool, PoolConfig } from 'pg';

let defaultPool: Pool | null = null;

export const createPgPool = (config?: PoolConfig): Pool => {
  const connectionString = process.env.DATABASE_URL || process.env.PG_URL;
  
  const poolConfig: PoolConfig = {
    ...(connectionString ? { connectionString } : {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
      database: process.env.PG_DATABASE || 'bharatclap',
    }),
    max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ...config,
  };

  return new Pool(poolConfig);
};

export const getPgPool = (): Pool => {
  if (!defaultPool) {
    defaultPool = createPgPool();
  }
  return defaultPool;
};

export const closePgPool = async (): Promise<void> => {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
};
