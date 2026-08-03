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

import { backfillProviderCodesBatch } from "./utils/providerIdGenerator";

import { expirePackages, releaseExpiredReservations } from "./services/leadService";

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[PROVIDER-SERVICE] 🚀 Provider Service listening on Port ${PORT}`);
  startDailyReconciliation();
  startSettlementCron();
  startLocationCleanupCron();
  runSubscriptionCronJob();
  startReassignmentCron();
  
  // Lead Package Scheduler: expire packages every hour, release reservations every 1m
  setInterval(expirePackages, 60 * 60 * 1000);
  setInterval(releaseExpiredReservations, 60 * 1000);
  setTimeout(expirePackages, 10000); // Initial check after startup

  backfillProviderCodesBatch().then((res) => {
    if (res.processed > 0) {
      console.log(`[PROVIDER-CODE-MIGRATION] Backfilled ${res.success}/${res.processed} provider codes.`);
    }
  }).catch((err) => console.error('[PROVIDER-CODE-MIGRATION] Error:', err.message));
});

setupLifecycle({
  serviceName: 'PROVIDER-SERVICE',
  port: PORT,
  server,
  mongoose,
  socketIO: io,
});
