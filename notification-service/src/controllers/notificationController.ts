import { Request, Response } from 'express';
import { NotificationRepository } from '../repositories/notificationRepository';
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
    const userRole = req.user?.role === 'provider' ? 'provider' : 'customer';
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    const { notifications, total } = await NotificationRepository.findUserNotifications({
      userId: String(req.user?._id),
      role: userRole,
      since,
      page,
      limit,
    });

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

    const { notifications, total } = await NotificationRepository.findAdminNotifications({
      page,
      limit,
    });

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
    const notification = await NotificationRepository.markAsRead(req.params.id, String(req.user?._id));

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
    const success = await NotificationRepository.deleteNotification(req.params.id, String(req.user?._id));

    if (!success) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

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
    const notification = await NotificationRepository.markAsRead(req.params.id, undefined, true);

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
    const success = await NotificationRepository.deleteNotification(req.params.id, undefined, true);

    if (!success) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

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
    const notification = await NotificationRepository.createNotification({
      recipient_id: recipient_id || undefined,
      recipient_type: recipient_type || 'customer',
      title,
      message,
      type: type || 'system_alert',
      metadata,
    });

    // Forward to provider-service for Socket.io delivery
    if (recipient_id) {
      const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
      const internalKey = getInternalServiceKey();
      const importAxios = (await import('axios')).default;
      const eventName = recipient_type === 'Provider' || recipient_type === 'provider' ? 'provider_notification' : 'user_notification';

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
          createdAt: notification.createdAt,
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
    const notification = await NotificationRepository.markAsRead(req.params.id, String(req.user?._id));
    if (!notification) {
      res.status(404).json({ message: 'Notification not found or already delivered' });
      return;
    }
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all user notifications as seen
// @route   PUT /api/notifications/seen
// @access  Private
export const markAsSeen = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const modified = await NotificationRepository.markAllAsSeen(String(req.user?._id));
    res.json({ message: 'Notifications marked as seen', modified });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
