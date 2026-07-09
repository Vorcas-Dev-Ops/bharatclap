import http from 'http';
import dotenv from 'dotenv';
import app from './app';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const PORT = process.env.PORT || 5000;
const PROVIDER_SERVICE = process.env.PROVIDER_SERVICE_URL || 'http://localhost:5003';

const server = http.createServer(app);

// WebSocket Proxy handling for real-time provider geo-tracking & chat!
const wsProxy = createProxyMiddleware({
  target: PROVIDER_SERVICE,
  ws: true,
  changeOrigin: true
});

app.use('/socket.io', wsProxy);

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/socket.io')) {
    wsProxy.upgrade!(req, socket as any, head);
  }
});

// Start listening for incoming connections
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 API Gateway listening on Port ${PORT}`);
  console.log(`🔗 Routing WebSocket/Socket.io geo-tracking to Provider Service at ${PROVIDER_SERVICE}`);
});

const gracefulShutdown = (signal: string) => {
  console.log(`[API-GATEWAY] ⚠️ ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('[API-GATEWAY] 🛑 HTTP server closed. Exit.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('[API-GATEWAY] ⚠️ Force exit after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
