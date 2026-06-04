import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
  console.log(`Booking Service running on ${PORT}`);
});
