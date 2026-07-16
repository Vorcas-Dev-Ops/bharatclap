import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import { Provider } from '../models/Provider';

let io: Server;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;
let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying and fail open
      return Math.min(times * 100, 2000);
    }
  });

  redisClient.on('connect', () => {
    console.log('🚀 [SOCKET SERVER] Redis connected for buffering');
    isRedisAvailable = true;
  });

  redisClient.on('error', (err) => {
    console.warn('⚠️ [SOCKET SERVER] Redis connection error (using in-memory fallback):', err.message);
    isRedisAvailable = false;
  });

  // Pub/Sub for socket.io scaling
  redisPubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
  redisSubClient = redisPubClient.duplicate();

  redisPubClient.on('error', (err) => {
    console.warn('⚠️ [SOCKET SERVER] Redis Pub Client error:', err.message);
  });
  redisSubClient.on('error', (err) => {
    console.warn('⚠️ [SOCKET SERVER] Redis Sub Client error:', err.message);
  });
} catch (error: any) {
  console.warn('⚠️ [SOCKET SERVER] Failed to initialize Redis (using in-memory fallback):', error.message);
}

// Fallback in-memory buffer
const localLocationBuffer = new Map<string, { lat: number, lng: number, timestamp: Date }>();
const REDIS_BUFFER_KEY = 'provider:locations:buffer';

// Flush location buffer to DB every 15 seconds
setInterval(async () => {
  const bulkOps = [];
  const processedProviderIds: string[] = [];

  if (isRedisAvailable && redisClient) {
    try {
      const records = await redisClient.hgetall(REDIS_BUFFER_KEY);
      const keys = Object.keys(records);
      if (keys.length > 0) {
        for (const providerId of keys) {
          try {
            const loc = JSON.parse(records[providerId]);
            bulkOps.push({
              updateOne: {
                filter: { _id: providerId },
                update: {
                  $set: {
                    'live_location.type': 'Point',
                    'live_location.coordinates': [loc.lng, loc.lat],
                    lastActiveAt: new Date(loc.timestamp),
                    isOnline: true
                  }
                }
              }
            });
            processedProviderIds.push(providerId);
          } catch (e: any) {
            console.error(`Error parsing location for provider ${providerId}:`, e.message);
          }
        }
      }
    } catch (err: any) {
      console.error('Error reading location buffer from Redis:', err.message);
    }
  } else {
    if (localLocationBuffer.size > 0) {
      for (const [providerId, loc] of localLocationBuffer.entries()) {
        bulkOps.push({
          updateOne: {
            filter: { _id: providerId },
            update: {
              $set: {
                'live_location.type': 'Point',
                'live_location.coordinates': [loc.lng, loc.lat],
                lastActiveAt: loc.timestamp,
                isOnline: true
              }
            }
          }
        });
        processedProviderIds.push(providerId);
      }
    }
  }

  if (bulkOps.length === 0) return;

  try {
    await Provider.bulkWrite(bulkOps);

    // Clear processed elements only AFTER successful write to avoid data loss
    if (isRedisAvailable && redisClient && processedProviderIds.length > 0) {
      await redisClient.hdel(REDIS_BUFFER_KEY, ...processedProviderIds);
    } else {
      for (const id of processedProviderIds) {
        localLocationBuffer.delete(id);
      }
    }
  } catch (err: any) {
    console.error('Error flushing location buffer to DB:', err.message);
    // Note: Do NOT clear the buffers on failure to avoid losing provider tracking updates
  }
}, 15000);

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  if (redisPubClient && redisSubClient) {
    io.adapter(createAdapter(redisPubClient, redisSubClient));
    console.log('🚀 [SOCKET SERVER] Redis Adapter configured for Socket.io scaling');
  }

  io.on('connection', (socket: Socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join', async (data: { userId: string; role: 'user' | 'provider' }) => {
      try {
        if (data.role === 'provider') {
          await Provider.findOneAndUpdate(
            { user_id: data.userId },
            { 
              socketId: socket.id, 
              lastActiveAt: new Date(),
              isOnline: true // Auto-online when connected to dashboard
            }
          );
        }
        socket.join(data.userId);
        console.log(`${data.role} ${data.userId} joined room`);
      } catch (error) {
        console.error('Socket join error:', error);
      }
    });

    socket.on('updateLocation', async (data: { providerId: string; lat: number; lng: number }) => {
      const timestamp = new Date();
      if (isRedisAvailable && redisClient) {
        try {
          await redisClient.hset(
            REDIS_BUFFER_KEY,
            data.providerId,
            JSON.stringify({ lat: data.lat, lng: data.lng, timestamp })
          );
        } catch (err: any) {
          console.warn('Redis HSET failed, buffering locally:', err.message);
          localLocationBuffer.set(data.providerId, { lat: data.lat, lng: data.lng, timestamp });
        }
      } else {
        localLocationBuffer.set(data.providerId, { lat: data.lat, lng: data.lng, timestamp });
      }
    });

    socket.on('disconnect', async () => {
      try {
        console.log('Client disconnected:', socket.id);
        await Provider.findOneAndUpdate(
          { socketId: socket.id },
          { 
            socketId: undefined,
            isOnline: false,
            availability_status: 'offline'
          }
        );
      } catch (error) {
        console.error('Socket disconnect error:', error);
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    const roomId = userId.toString();
    io.to(roomId).emit(event, data);
  } else {
    console.warn('[SOCKET SERVER] Cannot emit event, io is not initialized.');
  }
};

export { redisClient, isRedisAvailable };
