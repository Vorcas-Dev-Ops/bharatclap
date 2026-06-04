import express from "express";
import cors from "cors";
import paymentRoutes from "./routes/paymentRoutes";
import refundRoutes from "./routes/refundRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
 "/api/payments",
 paymentRoutes
);
app.use(
 "/api/refunds",
 refundRoutes
);

export default app;
