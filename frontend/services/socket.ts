import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://127.0.0.1:5000';

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const connectSocket = (userId: string, role: 'user' | 'provider') => {
  const s = getSocket();

  const emitJoin = () => s.emit('join', { userId, role });

  if (!s.connected) {
    // Wait for the connection to open before joining the room
    s.once('connect', emitJoin);
    s.connect();
  } else {
    // Already connected — re-join the room immediately (e.g. after page navigation)
    emitJoin();
  }

  // Re-join room on every reconnect (server-side rooms are lost on disconnect)
  s.off('reconnect', emitJoin); // prevent duplicate listeners
  s.on('reconnect', emitJoin);

  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
