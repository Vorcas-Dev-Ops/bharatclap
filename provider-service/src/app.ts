import express from "express";
import cors from "cors";
import helmet from "helmet";
import providerRoutes from "./routes/providerRoutes";
import providerServiceRoutes from "./routes/providerServiceRoutes";
import walletRoutes from "./routes/walletRoutes";
import payoutRoutes from "./routes/payoutRoutes";
import starterKitRoutes from "./routes/starterKitRoutes";
import kitOrderRoutes from "./routes/kitOrderRoutes";
import waiverRoutes from "./routes/waiverRoutes";

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

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

app.use("/api/providers", providerRoutes);
app.use("/api/provider-services", providerServiceRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/starter-kits", starterKitRoutes);
app.use("/api/kit-orders", kitOrderRoutes);
app.use("/api/waivers", waiverRoutes);

app.use(errorHandler);

export default app;
