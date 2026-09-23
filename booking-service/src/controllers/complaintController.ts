import { Request, Response } from 'express';
import { ComplaintRepository } from '../repositories/complaintRepository';
import { AuthRequest } from '../middleware/authMiddleware';
import { getDb } from '../config/db';
import { getUsersBatch, getCatalogBatch, sendAdminNotification, sendNotification } from '../utils/internalApi';

const populateComplaints = async (complaints: any[]) => {
  if (!complaints || complaints.length === 0) return [];

  const userIds    = [...new Set(complaints.map(c => c.user_id?.toString()).filter(Boolean))];
  const bookingIds = [...new Set(complaints.map(c => c.booking_id?.toString()).filter(Boolean))];

  const db = getDb();
  const [users, bookingsRes] = await Promise.all([
    getUsersBatch(userIds),
    db.query(`SELECT id, booking_id, user_id, provider_id, status FROM booking.bookings WHERE id::text = ANY($1::text[])`, [bookingIds])
  ]);

  const userMap    = new Map(users.map((u: any) => [String(u._id), u]));
  const bookingMap = new Map(bookingsRes.rows.map((b: any) => [String(b.id), b]));

  return complaints.map(c => ({
    ...c,
    user_id:    userMap.get(String(c.user_id))    || c.user_id,
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
    const offset = (page - 1) * limit;

    const db = getDb();
    const [countRes, dataRes] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total FROM booking.complaints`),
      db.query(`SELECT * FROM booking.complaints ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset])
    ]);

    const total = countRes.rows[0]?.total || 0;
    const populated = await populateComplaints(dataRes.rows);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
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
    const offset = (page - 1) * limit;

    const db = getDb();
    const [countRes, dataRes] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total FROM booking.complaints
         WHERE user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)`,
        [req.params.userId]
      ),
      db.query(
        `SELECT * FROM booking.complaints
         WHERE user_id::text = $1 OR user_id = (SELECT id FROM auth.users WHERE legacy_mongo_id = $1 LIMIT 1)
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.params.userId, limit, offset]
      )
    ]);

    const total = countRes.rows[0]?.total || 0;
    const populated = await populateComplaints(dataRes.rows);
    res.json({ data: populated, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit a complaint
// @route   POST /api/complaints
// @access  Private
export const submitComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { booking_id, complaint, description } = req.body;
    const complaintText = complaint || description || '';

    const newComplaint = await ComplaintRepository.create({
      bookingId: booking_id,
      userId: req.user?._id || '',
      description: complaintText,
      status: 'open'
    });

    await sendAdminNotification(
      'New Customer Complaint',
      `A new complaint was submitted: "${complaintText.substring(0, 50)}${complaintText.length > 50 ? '...' : ''}"`,
      'system_alert',
      { complaint_id: newComplaint.id, booking_id }
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
    const complaint = await ComplaintRepository.updateStatus(req.params.id, status);
    if (!complaint) {
      res.status(404).json({ message: 'Complaint not found' });
      return;
    }

    sendNotification(
      complaint.user_id.toString(),
      'Support Ticket Update',
      `Your support complaint #${complaint.id.slice(-6).toUpperCase()} status has been updated to '${status}'.`,
      'system_alert',
      { complaint_id: complaint.id, status }
    ).catch(err => console.error('[NOTIFICATION] Failed to send support ticket update:', err));

    res.json(complaint);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
