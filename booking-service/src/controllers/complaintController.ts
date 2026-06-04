import { Request, Response } from 'express';
import { Complaint } from '../models/Complaint';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose, { Schema } from 'mongoose';

// Decoupled Connections
let authConnection: mongoose.Connection | null = null;
let catalogConnection: mongoose.Connection | null = null;

let UserModel: any = null;
let ServiceModel: any = null;

const getAuthDb = () => {
  if (!authConnection) {
    const authDbURI = process.env.AUTH_DB_URI || 'mongodb://localhost:27017/auth_db';
    authConnection = mongoose.createConnection(authDbURI);
  }
  return authConnection;
};

const getCatalogDb = () => {
  if (!catalogConnection) {
    const catalogDbURI = process.env.CATALOG_DB_URI || 'mongodb://localhost:27017/catalog_db';
    catalogConnection = mongoose.createConnection(catalogDbURI);
  }
  return catalogConnection;
};

const getUserModel = () => {
  if (!UserModel) {
    UserModel = getAuthDb().model('User', new Schema({}, { strict: false }), 'users');
  }
  return UserModel;
};

const getServiceModel = () => {
  if (!ServiceModel) {
    ServiceModel = getCatalogDb().model('Service', new Schema({}, { strict: false }), 'services');
  }
  return ServiceModel;
};

const populateComplaints = async (complaints: any[]) => {
  if (!complaints || complaints.length === 0) return [];

  const userIds = complaints.map(c => c.user_id).filter(Boolean);
  const serviceIds = complaints.map(c => c.service_id).filter(Boolean);
  const bookingIds = complaints.map(c => c.booking_id).filter(Boolean);
  
  const BookingModel = mongoose.model('Booking');

  const UModel = getUserModel();
  const SModel = getServiceModel();

  const [users, services, bookings] = await Promise.all([
    UModel.find({ _id: { $in: userIds } }).select('name email').lean(),
    SModel.find({ _id: { $in: serviceIds } }).select('service_name').lean(),
    BookingModel.find({ _id: { $in: bookingIds } }).lean()
  ]);

  const userMap = new Map(users.map((u: any) => [String(u._id), u]));
  const serviceMap = new Map(services.map((s: any) => [String(s._id), s]));
  const bookingMap = new Map(bookings.map(b => [String(b._id), b]));

  return complaints.map(c => ({
    ...c,
    user_id: userMap.get(String(c.user_id)) || c.user_id,
    service_id: serviceMap.get(String(c.service_id)) || c.service_id,
    booking_id: bookingMap.get(String(c.booking_id)) || c.booking_id
  }));
};

// @desc    Get all complaints
// @route   GET /api/complaints
// @access  Private/Admin
export const getComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 }).lean();
    const populated = await populateComplaints(complaints);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get complaints by user ID
// @route   GET /api/complaints/user/:userId
// @access  Private/Admin
export const getComplaintsByUserId = async (req: Request, res: Response): Promise<void> => {
  try {
    const complaints = await Complaint.find({ user_id: new mongoose.Types.ObjectId(req.params.userId) })
      .sort({ createdAt: -1 })
      .lean();
    const populated = await populateComplaints(complaints);
    res.json(populated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit a complaint
// @route   POST /api/complaints
// @access  Private
export const submitComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { service_id, booking_id, complaint } = req.body;
    const newComplaint = await Complaint.create({
      user_id: new mongoose.Types.ObjectId(req.user?._id),
      service_id: service_id ? new mongoose.Types.ObjectId(service_id as string) : undefined,
      booking_id: booking_id ? new mongoose.Types.ObjectId(booking_id as string) : undefined,
      complaint
    });
    res.status(201).json(newComplaint);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update complaint status
// @route   PUT /api/complaints/:id
// @access  Private/Admin
export const updateComplaintStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!complaint) {
      res.status(404).json({ message: 'Complaint not found' });
      return;
    }
    res.json(complaint);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
