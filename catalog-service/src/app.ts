import express from 'express';
import cors from 'cors';
import categoryRoutes from './routes/categoryRoutes';
import serviceRoutes from './routes/serviceRoutes';
import subServiceRoutes from './routes/subServiceRoutes';
import bannerRoutes from './routes/bannerRoutes';
import offerRoutes from './routes/offerRoutes';
import couponRoutes from './routes/couponRoutes';
import membershipRoutes from './routes/membershipRoutes';
import commissionRoutes from './routes/commissionRoutes';
import settingsRoutes from './routes/settingsRoutes';
import timeSlotRoutes from './routes/timeSlotRoutes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/categories', categoryRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sub-services', subServiceRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/timeslot-rules', timeSlotRoutes);

export default app;
