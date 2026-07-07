import { Server, Socket } from 'socket.io';
import { Provider } from '../models/Provider';

let io: Server;

// Buffer for live location updates (providerId -> {lat, lng, timestamp})
const locationBuffer = new Map<string, { lat: number, lng: number, timestamp: Date }>();

// Flush location buffer to DB every 15 seconds
setInterval(async () => {
  if (locationBuffer.size === 0) return;
  
  const bulkOps = [];
  for (const [providerId, loc] of locationBuffer.entries()) {
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
  }
  
  // Clear the buffer immediately so new updates are collected while DB writes
  locationBuffer.clear();
  
  try {
    if (bulkOps.length > 0) {
      await Provider.bulkWrite(bulkOps);
    }
  } catch (err) {
    console.error('Error flushing location buffer to DB:', err);
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

    socket.on('updateLocation', (data: { providerId: string; lat: number; lng: number }) => {
      locationBuffer.set(data.providerId, { lat: data.lat, lng: data.lng, timestamp: new Date() });
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
    io.to(userId.toString()).emit(event, data);
  }
};
