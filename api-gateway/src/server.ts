import http from 'http';
import dotenv from 'dotenv';
import app from './app';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { setupLifecycle } from './utils/lifecycle';

dotenv.config();

const PORT = Number(process.env.PORT) || 5000;
const PROVIDER_SERVICE = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';

const server = http.createServer(app);

const wsProxy = createProxyMiddleware({
  pathFilter: (path: string) => path.startsWith('/socket.io'),
  target: PROVIDER_SERVICE,
  ws: true,
  changeOrigin: true
});

app.use(wsProxy);

server.on('upgrade', (req, socket, head) => {
  if (req.url && req.url.startsWith('/socket.io')) {
    wsProxy.upgrade!(req, socket as any, head);
  }
});

setupLifecycle({
  serviceName: 'API-GATEWAY',
  port: PORT,
  server,
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[API-GATEWAY] 🚀 Listening on Port ${PORT}`);
  console.log(`[API-GATEWAY] 🔗 Routing WebSocket/Socket.io to Provider Service at ${PROVIDER_SERVICE}`);
});
