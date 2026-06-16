import express from "express";
import cors from "cors";
import paymentRoutes from "./routes/paymentRoutes";
import refundRoutes from "./routes/refundRoutes";
import userMembershipRoutes from "./routes/userMembershipRoutes";
import couponUsageRoutes from "./routes/couponUsageRoutes";

const app = express();

app.use(express.json());

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

export default app;
