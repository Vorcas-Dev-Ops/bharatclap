import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import refundRoutes from './routes/refundRoutes';

const app = express();

app.use(helmet());
import { corsMiddleware } from './utils/corsConfig';

app.use(corsMiddleware);
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'refund-service', timestamp: new Date() });
});

// API Routes
app.use('/api/refunds', refundRoutes);

export default app;
