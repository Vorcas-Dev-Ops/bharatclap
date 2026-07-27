import express from "express";
import cors from "cors";
import helmet from "helmet";
import bookingRoutes from "./routes/bookingRoutes";
import cartRoutes from "./routes/cartRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import complaintRoutes from "./routes/complaintRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import chartRoutes from "./routes/chartRoutes";
import reportRoutes from "./routes/reportRoutes";
import refundPolicyRoutes from "./routes/refundPolicyRoutes";

const app = express();

app.use(helmet());

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173', 'https://bharatclap.in', 'http://localhost:5000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    if (res.statusCode === 500) {
      console.error('[500 ERROR INTERCEPTOR]', body);
      return originalJson.call(this, { message: body?.message || body?.error || 'Internal Server Error' });
    }
    return originalJson.call(this, body);
  };
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  if (req.query && req.query.limit) {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    if (!isNaN(parsedLimit)) {
      req.query.limit = String(Math.min(parsedLimit, 100));
    }
  }
  next();
});

import { errorHandler } from "./middleware/errorHandler";

app.use("/api/bookings", bookingRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/charts", chartRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/refund-policy", refundPolicyRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'booking-service' }));

app.use(errorHandler);

export default app;

