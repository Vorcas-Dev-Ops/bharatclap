import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";
import "./workers/notificationWorker"; // Start the background worker


dotenv.config();

connectDB();

const PORT = process.env.PORT || 5006;

app.listen(PORT, () => {
  console.log(`Notification Service running on ${PORT}`);
});

