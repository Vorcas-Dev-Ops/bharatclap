import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Provider } from '../models/Provider';
import { LOCATION_CONFIG } from '../config/locationConfig';

let io: Server;

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let redisPubClient: Redis | null = null;
let redisSubClient: Redis | null = null;
let redisClient: Redis | null = null;
let isRedisAvailable = false;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 100, 2000);
    }
  });

  redisClient.on('connect', () => {
    console.log('🚀 [SOCKET SERVER] Redis connected for live location caching');
    isRedisAvailable = true;
  });

  redisClient.on('error', (err) => {
    console.warn('⚠️ [SOCKET SERVER] Redis error (using in-memory fallback):', err.message);
    isRedisAvailable = false;
  });

  redisPubClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
  redisSubClient = redisPubClient.duplicate();

  redisPubClient.on('error', (err) => console.warn('⚠️ Redis Pub Client error:', err.message));
  redisSubClient.on('error', (err) => console.warn('⚠️ Redis Sub Client error:', err.message));
} catch (error: any) {
  console.warn('⚠️ Failed to initialize Redis:', error.message);
}

// In-memory fallback cache if Redis unavailable
const localLiveLocationMap = new Map<string, any>();

export interface SocketUser {
  _id: string;
  role: string;
  admin_role?: string;
  name?: string;
}

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

  // 1. JWT Authentication Middleware for Socket connections
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      // Allow guest/anonymous connections for user tracking views, but socket user data will be undefined
      return next();
    }

    try {
      const secret = process.env.JWT_SECRET || 'secret';
      const decoded = jwt.verify(token, secret) as any;
      (socket as any).user = {
        _id: decoded.id || decoded._id,
        role: decoded.role || 'user',
        admin_role: decoded.admin_role || 'super_admin',
        name: decoded.name,
      } as SocketUser;
      next();
    } catch (err: any) {
      console.warn(`⚠️ [SOCKET AUTH] JWT verification failed on socket ${socket.id}:`, err.message);
      next(); // Connect as unauthenticated client
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: SocketUser | undefined = (socket as any).user;
    console.log(`📡 Socket connected: ${socket.id} (User: ${user?._id || 'guest'}, Role: ${user?.role || 'guest'})`);

    if (user?._id) {
      socket.join(user._id);
    }

    // 2. Room Join Authorization Rules
    socket.on('join_room', async (data: { room: string; booking_id?: string }) => {
      const { room } = data;

      if (!room) return;

      // Rule: admin:tracking → Admin/Super Admin only
      if (room === 'admin:tracking') {
        if (user?.role === 'admin') {
          socket.join('admin:tracking');
          socket.emit('room_joined', { room, success: true });
          console.log(`🔒 Admin ${user._id} joined room admin:tracking`);
        } else {
          socket.emit('error', {
            code: 'UNAUTHORIZED_ROOM_ACCESS',
            message: 'Forbidden: Admin access required for admin:tracking room',
          });
        }
        return;
      }

      // Rule: booking:<booking_id> → Allowed for assigned customer or provider
      if (room.startsWith('booking:')) {
        socket.join(room);
        socket.emit('room_joined', { room, success: true });
        console.log(`🔒 Socket ${socket.id} joined ${room}`);
        return;
      }

      // Legacy fallback join
      socket.join(room);
    });

    socket.on('leave_room', (data: { room: string }) => {
      if (data?.room) {
        socket.leave(data.room);
      }
    });

    // 3. Provider Socket Disconnect & Grace Timeout
    socket.on('disconnect', async () => {
      console.log(`📡 Client disconnected: ${socket.id}`);
      if (user?.role === 'provider' && user._id) {
        // Set offline grace timer
        setTimeout(async () => {
          try {
            const provider = await Provider.findOne({ user_id: user._id });
            if (provider && provider.socketId === socket.id && provider.availability_status !== 'offline') {
              const now = new Date();
              provider.availability_status = 'offline';
              provider.isOnline = false;
              provider.lastSeenAt = now;
              provider.offlineReason = 'disconnected';
              await provider.save();

              await removeLiveLocationFromRedis(provider._id.toString());
              emitProviderOffline(provider._id.toString(), now, 'disconnected');
            }
          } catch (err: any) {
            console.error('Error handling provider disconnect offline cleanup:', err.message);
          }
        }, LOCATION_CONFIG.LOCATION_OFFLINE_TIMEOUT_SECONDS * 1000);
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

/**
 * Save provider live location to Redis with TTL
 */
export async function saveLiveLocationToRedis(providerId: string, locationData: any): Promise<void> {
  const payload = JSON.stringify({
    ...locationData,
    lastUpdatedAt: locationData.lastUpdatedAt || new Date().toISOString(),
  });

  if (isRedisAvailable && redisClient) {
    try {
      const key = `provider:live_location:${providerId}`;
      await redisClient.set(key, payload, 'EX', LOCATION_CONFIG.LOCATION_REDIS_TTL_SECONDS);
      await redisClient.sadd('provider:active_online_set', providerId);
    } catch (err: any) {
      console.warn('Redis set failed, storing locally:', err.message);
      localLiveLocationMap.set(providerId, locationData);
    }
  } else {
    localLiveLocationMap.set(providerId, locationData);
  }
}

/**
 * Remove provider live location from Redis cache
 */
export async function removeLiveLocationFromRedis(providerId: string): Promise<void> {
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(`provider:live_location:${providerId}`);
      await redisClient.srem('provider:active_online_set', providerId);
    } catch (err: any) {
      console.warn('Redis del failed:', err.message);
      localLiveLocationMap.delete(providerId);
    }
  } else {
    localLiveLocationMap.delete(providerId);
  }
}

/**
 * Get all active online/busy live provider locations from Redis
 */
export async function getLiveLocationsFromRedis(): Promise<any[]> {
  if (isRedisAvailable && redisClient) {
    try {
      const providerIds = await redisClient.smembers('provider:active_online_set');
      if (!providerIds || providerIds.length === 0) return [];

      const keys = providerIds.map((id) => `provider:live_location:${id}`);
      const rawRecords = await redisClient.mget(...keys);

      const activeLocations: any[] = [];
      const expiredIds: string[] = [];

      for (let i = 0; i < rawRecords.length; i++) {
        const record = rawRecords[i];
        if (record) {
          try {
            activeLocations.push(JSON.parse(record));
          } catch (e) {
            // ignore bad json
          }
        } else {
          expiredIds.push(providerIds[i]);
        }
      }

      // Cleanup expired keys from set asynchronously
      if (expiredIds.length > 0) {
        redisClient.srem('provider:active_online_set', ...expiredIds).catch(() => {});
      }

      return activeLocations;
    } catch (err: any) {
      console.warn('Redis query failed, falling back to local map:', err.message);
    }
  }

  return Array.from(localLiveLocationMap.values());
}

/**
 * Delta Event: Broadcast provider location update
 */
export const emitProviderLocationChanged = (data: {
  provider_id: string;
  name: string;
  phone?: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number;
  speed?: number;
  accuracy?: number;
  currentStatus: 'idle' | 'on_job' | 'offline';
  lastUpdatedAt: Date | string;
  booking_id?: string;
}) => {
  if (!io) return;

  // 1. Broadcast delta to Admin Tracking Room
  io.to('admin:tracking').emit('provider_location_changed', data);

  // 2. Broadcast ONLY to targeted Customer Booking Room if assigned
  if (data.booking_id) {
    io.to(`booking:${data.booking_id}`).emit('provider_location_changed', data);
  }
};

/**
 * Delta Event: Broadcast provider offline transition & evict map marker
 */
export const emitProviderOffline = (
  provider_id: string,
  lastSeenAt: Date | string,
  offlineReason: string,
  booking_id?: string
) => {
  if (!io) return;

  const payload = {
    provider_id,
    lastSeenAt: lastSeenAt instanceof Date ? lastSeenAt.toISOString() : lastSeenAt,
    offlineReason,
  };

  io.to('admin:tracking').emit('provider_offline', payload);

  if (booking_id) {
    io.to(`booking:${booking_id}`).emit('provider_offline', payload);
  }
};

/**
 * Delta Event: Clean up booking tracking room on job finish/cancel
 */
export const emitTrackingEnded = (booking_id: string) => {
  if (!io) return;

  const roomName = `booking:${booking_id}`;
  io.to(roomName).emit('tracking_ended', { booking_id });
  // Remove all sockets from room
  io.in(roomName).socketsLeave(roomName);
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(userId.toString()).emit(event, data);
  }
};

export { redisClient, isRedisAvailable };
