import { Server, Socket } from 'socket.io';
import { Provider } from '../models/Provider';

let io: Server;

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST'],
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

    socket.on('updateLocation', async (data: { providerId: string; lat: number; lng: number }) => {
      try {
        await Provider.findByIdAndUpdate(data.providerId, {
          live_location: {
            type: 'Point',
            coordinates: [data.lng, data.lat], // MongoDB uses [lng, lat]
          },
          lastActiveAt: new Date(),
          isOnline: true
        });
      } catch (error) {
        console.error('Socket updateLocation error:', error);
      }
    });

    socket.on('disconnect', async () => {
      try {
        console.log('Client disconnected:', socket.id);
        await Provider.findOneAndUpdate({ socketId: socket.id }, { socketId: undefined });
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
