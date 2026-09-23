import { Request, Response } from 'express';
import { Notification } from '../models/Notification';
import { AuthRequest } from '../middleware/authMiddleware';
import { notificationQueue } from '../config/queue';
import { getInternalServiceKey } from '@bharatclap/shared';

// @desc    Get user notifications
// @route   GET /api/notifications?since=ISO8601&page=1&limit=20
// @access  Private
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const userRole = req.user?.role === 'provider' ? 'Provider' : 'User';

    // Optional: only return notifications created after this timestamp (delta sync)
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    const filter: any = {
      $or: [
        { recipient_id: req.user?._id },
        // Broadcast notifications: time-bound to last 30 days max for non-since queries
        {
          recipient_type: userRole,
          recipient_id: { $exists: false },
          createdAt: { $gte: since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        {
          recipient_type: userRole,
          recipient_id: null,
          createdAt: { $gte: since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      ],
      isDeleted: { $ne: true },
    };

    // For targeted (non-broadcast) notifications, apply since filter if provided
    if (since) {
      filter.$or[0].createdAt = { $gte: since };
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter)
    ]);

    res.json({ data: notifications, total, page, limit, pages: Math.ceil(total / limit) });
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
    const filter = { recipient_type: 'Admin' as const, isDeleted: { $ne: true } };

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter)
    ]);

    res.json({ data: notifications, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Single atomic update — avoids two-trip findOne + save pattern
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient_id: req.user?._id },
      { $set: { is_read: true } },
      { new: true, lean: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

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
    // Single atomic update — avoids two-trip findOne + save pattern
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient_type: 'Admin' },
      { $set: { is_read: true } },
      { new: true, lean: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

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

    // Forward to provider-service for Socket.io delivery
    if (recipient_id) {
      const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      const internalKey = getInternalServiceKey();
      const importAxios = (await import('axios')).default;
      const eventName = recipient_type === 'Provider' ? 'provider_notification' : 'user_notification';
      
      importAxios.post(`${PROVIDER_SERVICE_URL}/api/internal/emit`, {
        userId: recipient_id,
        event: eventName,
        data: {
          _id: notification._id,
          recipient_id,
          recipient_type,
          title,
          message,
          type: type || 'system_alert',
          metadata,
          is_read: false,
          createdAt: notification.createdAt
        }
      }, {
        headers: { 'x-internal-service-key': internalKey }
      }).catch(err => {
        console.error('[NOTIFICATION SOCKET EMIT ERROR]', err.message);
      });
    }

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

// @desc    Mark notification as delivered (set delivered_at timestamp)
// @route   PUT /api/notifications/:id/delivered
// @access  Private
export const markAsDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient_id: req.user?._id, delivered_at: null },
      { $set: { delivered_at: new Date() } },
      { new: true, lean: true }
    );
    if (!notification) {
      res.status(404).json({ message: 'Notification not found or already delivered' });
      return;
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all user notifications as seen (bulk — for when notification screen is opened)
// @route   PUT /api/notifications/seen
// @access  Private
export const markAsSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await Notification.updateMany(
      { recipient_id: req.user?._id, seen_at: null, isDeleted: { $ne: true } },
      { $set: { seen_at: new Date() } }
    );
    res.json({ message: 'Notifications marked as seen', modified: result.modifiedCount });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
