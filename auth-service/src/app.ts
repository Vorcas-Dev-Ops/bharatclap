import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoutes';
import addressRoutes from './routes/addressRoutes';
import locationRoutes from './routes/locationRoutes';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use('/api/users', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/locations', locationRoutes);

export default app;
