import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/authMiddleware';
import { notificationQueue } from '../config/queue';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const notifications = await Notification.find({ recipient_id: req.user?._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get admin notifications
// @route   GET /api/notifications/admin
// @access  Private/Admin
export const getAdminNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const notifications = await Notification.find({ recipient_type: 'Admin' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json(notifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient_id: req.user?._id });

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    notification.is_read = true;
    await notification.save();
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private
export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient_id: req.user?._id });

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    await notification.deleteOne();
    res.json({ message: 'Notification removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark admin notification as read
// @route   PUT /api/notifications/admin/:id/read
// @access  Private/Admin
export const markAdminAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient_type: 'Admin' });

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    notification.is_read = true;
    await notification.save();
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete admin notification
// @route   DELETE /api/notifications/admin/:id
// @access  Private/Admin
export const deleteAdminNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOne({ _id: req.params.id, recipient_type: 'Admin' });

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    await notification.deleteOne();
    res.json({ message: 'Notification removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create notification (Internal/Admin)
// @route   POST /api/notifications
// @access  Private/Admin or Internal
export const createNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipient_id, recipient_type, title, message, type, metadata } = req.body;
    const notification = await Notification.create({ 
      recipient_id: recipient_id || undefined, 
      recipient_type: recipient_type || 'User', 
      title, 
      message,
      type: type || 'system_alert',
      metadata
    });

    res.status(201).json(notification);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Enqueue asynchronous notification job (Email/SMS)
// @route   POST /api/notifications/enqueue
// @access  Public/Internal
export const enqueueNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, recipient, title, body, metadata } = req.body;

    if (!type || !recipient) {
      res.status(400).json({ message: 'Type (email/sms) and recipient are required parameters' });
      return;
    }

    const job = await notificationQueue.add('send-notification', {
      type,
      recipient,
      title: title || 'Service Alert',
      body,
      metadata: metadata || {}
    });

    res.status(202).json({
      message: 'Notification successfully enqueued for asynchronous dispatch',
      jobId: job.id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
