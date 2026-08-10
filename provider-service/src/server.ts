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
import { startSettlementReconciliation } from "./utils/settlementReconciliation";

dotenv.config();

const PORT = Number(process.env.PORT) || 5003;
const server = http.createServer(app);
const io = initSocket(server);

import { backfillProviderCodesBatch } from "./utils/providerIdGenerator";
import { expirePackages, releaseExpiredReservations } from "./services/leadService";

const startServer = async () => {
  await connectDB();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[PROVIDER-SERVICE] 🚀 Provider Service listening on Port ${PORT}`);

    // Defer non-critical background jobs outside HTTP startup path
    setImmediate(() => {
      startDailyReconciliation();
      startSettlementCron();
      startLocationCleanupCron();
      runSubscriptionCronJob();
      startReassignmentCron();
      
      setInterval(expirePackages, 60 * 60 * 1000);
      setInterval(releaseExpiredReservations, 60 * 1000);

      startSettlementReconciliation();
    });
  });
};

startServer();

setupLifecycle({
  serviceName: 'PROVIDER-SERVICE',
  port: PORT,
  server,
  mongoose,
  socketIO: io,
});
