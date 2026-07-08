import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/db";

connectDB();

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  console.log(`Payment Service running on ${PORT}`);
});

// Trigger nodemon reload after installing razorpay dependency
