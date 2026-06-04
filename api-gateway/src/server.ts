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

server.listen(Number(PORT), () => {
  console.log(`🚀 API Gateway listening on Port ${PORT}`);
  console.log(`🔗 Routing WebSocket/Socket.io geo-tracking to Provider Service at ${PROVIDER_SERVICE}`);
});
