import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './config/db';

dotenv.config();

connectDB();

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Auth Service running on Port ${PORT}`);
});
