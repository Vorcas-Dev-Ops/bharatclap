import dotenv from "dotenv";
import app from "./app";
import { connectDB } from "./config/db";

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5006;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
