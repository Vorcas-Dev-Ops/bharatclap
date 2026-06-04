import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import addressRoutes from './routes/addressRoutes';
import locationRoutes from './routes/locationRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/locations', locationRoutes);

export default app;
