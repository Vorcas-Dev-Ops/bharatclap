import express from "express";
import cors from "cors";
import bookingRoutes from "./routes/bookingRoutes";
import cartRoutes from "./routes/cartRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import complaintRoutes from "./routes/complaintRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import chartRoutes from "./routes/chartRoutes";
import reportRoutes from "./routes/reportRoutes";
import refundPolicyRoutes from "./routes/refundPolicyRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/bookings", bookingRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/charts", chartRoutes);
app.use("/api/admin/reports", reportRoutes);
app.use("/api/admin/refund-policy", refundPolicyRoutes);

export default app;

