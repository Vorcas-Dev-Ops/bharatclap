import express from "express";
import cors from "cors";
import helmet from "helmet";
import paymentRoutes from "./routes/paymentRoutes";
import refundRoutes from "./routes/refundRoutes";
import userMembershipRoutes from "./routes/userMembershipRoutes";
import couponUsageRoutes from "./routes/couponUsageRoutes";
import { errorHandler } from "./middleware/errorHandler";

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
      return originalJson.call(this, { message: 'Internal Server Error' });
    }
    return originalJson.call(this, body);
  };
  next();
});

app.use(express.json());

app.use((req, res, next) => {
  if (req.query && req.query.limit) {
    const parsedLimit = parseInt(req.query.limit as string, 10);
    if (!isNaN(parsedLimit)) {
      req.query.limit = String(Math.min(parsedLimit, 100));
    }
  }
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'payment-service' }));

app.use("/api/user-memberships", userMembershipRoutes);
app.use("/api/coupon-usages",    couponUsageRoutes);

app.use(
 "/api/payments",
 paymentRoutes
);
app.use(
 "/api/refunds",
 refundRoutes
);

app.use(errorHandler);

export default app;
