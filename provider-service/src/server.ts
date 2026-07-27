import http from "http";
import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./services/socketService";
import mongoose from "mongoose";
import { startDailyReconciliation } from "./utils/reconciliation";
import { startSettlementCron } from "./utils/settlementCron";
import { startLocationCleanupCron } from "./utils/locationCleanupCron";
import { runSubscriptionCronJob } from "./utils/subscriptionCron";
import { startReassignmentCron } from "./utils/reassignmentCron";
import { setupLifecycle } from "./utils/lifecycle";

dotenv.config();
connectDB();

const PORT = Number(process.env.PORT) || 5003;
const server = http.createServer(app);
const io = initSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PROVIDER-SERVICE] 🚀 Provider Service listening on Port ${PORT}`);
  startDailyReconciliation();
  startSettlementCron();
  startLocationCleanupCron();
  runSubscriptionCronJob();
  startReassignmentCron();
});

setupLifecycle({
  serviceName: 'PROVIDER-SERVICE',
  port: PORT,
  server,
  mongoose,
  socketIO: io,
});
