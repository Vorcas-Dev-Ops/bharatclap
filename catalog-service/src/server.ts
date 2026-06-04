import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/db';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  console.log(`Catalog Service running on Port ${PORT}`);
});
