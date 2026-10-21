import { Pool, PoolConfig } from 'pg';

let defaultPool: Pool | null = null;

export const createPgPool = (config?: PoolConfig): Pool => {
  let connectionString = config?.connectionString || process.env.DATABASE_URL || process.env.PG_URL || process.env.PG_URI;
  if (connectionString && connectionString.includes('@localhost:')) {
    connectionString = connectionString.replace('@localhost:', '@127.0.0.1:');
  }
  
  const poolConfig: PoolConfig = {
    ...(connectionString ? { connectionString } : {
      host: process.env.PG_HOST || '127.0.0.1',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || 'postgres',
      database: process.env.PG_DATABASE || 'bharatclap_migration_test',
    }),
    max: parseInt(process.env.PG_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '15000', 10),
    ...config,
    ...(connectionString ? { connectionString } : {}),
  };

  const pool = new Pool(poolConfig);
  pool.on('error', (err) => {
    console.error('[PG-POOL] Unexpected idle client error:', err.message);
  });
  return pool;
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
