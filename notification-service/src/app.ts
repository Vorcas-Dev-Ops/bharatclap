import express from "express";
import cors from "cors";
import notificationRoutes from "./routes/notificationRoutes";
import adminReportRoutes from "./routes/adminReportRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
 "/api/notifications",
 notificationRoutes
);
app.use(
 "/api/notifications/reports",
 adminReportRoutes
);

export default app;
