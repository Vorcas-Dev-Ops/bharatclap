import express from "express";
import cors from "cors";
import providerRoutes from "./routes/providerRoutes";
import providerServiceRoutes from "./routes/providerServiceRoutes";
import walletRoutes from "./routes/walletRoutes";
import payoutRoutes from "./routes/payoutRoutes";
import starterKitRoutes from "./routes/starterKitRoutes";
import kitOrderRoutes from "./routes/kitOrderRoutes";
import waiverRoutes from "./routes/waiverRoutes";
import internalRoutes from "./routes/internalRoutes";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/api/providers", providerRoutes);
app.use("/api/provider-services", providerServiceRoutes);
app.use("/api/wallets", walletRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/starter-kits", starterKitRoutes);
app.use("/api/kit-orders", kitOrderRoutes);
app.use("/api/waivers", waiverRoutes);
app.use("/api/internal", internalRoutes);

export default app;
