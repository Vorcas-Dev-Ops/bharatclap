import { Request, Response } from 'express';
import { Complaint } from '../models/Complaint';
import { Booking } from '../models/Booking';
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import { getUsersBatch, getCatalogBatch, sendAdminNotification } from '../utils/internalApi';

const populateComplaints = async (complaints: any[]) => {
  if (!complaints || complaints.length === 0) return [];

  const userIds    = [...new Set(complaints.map(c => c.user_id?.toString()).filter(Boolean))];
  const serviceIds = [...new Set(complaints.map(c => c.service_id?.toString()).filter(Boolean))];
  const bookingIds = [...new Set(complaints.map(c => c.booking_id?.toString()).filter(Boolean))];

  const [users, catalogData, bookings] = await Promise.all([
    getUsersBatch(userIds),
    getCatalogBatch([], serviceIds, [], []),
    Booking.find({ _id: { $in: bookingIds } }).lean()
  ]);

  const userMap    = new Map(users.map((u: any) => [String(u._id), u]));
  const serviceMap = new Map(catalogData.services.map((s: any) => [String(s._id), s]));
  const bookingMap = new Map(bookings.map(b => [String(b._id), b]));

  return complaints.map(c => ({
    ...c,
    user_id:    userMap.get(String(c.user_id))    || c.user_id,
    service_id: serviceMap.get(String(c.service_id)) || c.service_id,
    booking_id: bookingMap.get(String(c.booking_id)) || c.booking_id
  }));
};

// @desc    Get all complaints
// @route   GET /api/complaints
// @access  Private/Admin
export const getComplaints = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const complaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
      
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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    
    const complaints = await Complaint.find({ user_id: new mongoose.Types.ObjectId(req.params.userId) })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
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

    await sendAdminNotification(
      'New Customer Complaint',
      `A new complaint was submitted: "${complaint.substring(0, 50)}${complaint.length > 50 ? '...' : ''}"`,
      'system_alert',
      { complaint_id: newComplaint._id, booking_id }
    );

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
