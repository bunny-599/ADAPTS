import { Request, Response } from 'express';
import { pool, isDatabaseAvailable } from '../db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export interface NotificationRecord {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export class NotificationController {
  private static inMemoryNotifications = new Map<number, NotificationRecord[]>();
  private static nextNotificationId = 1;

  /**
   * GET /api/notifications
   * Retrieves authenticated user's notifications.
   */
  public static async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(200).json({ success: true, data: { notifications: [], unreadCount: 0 }, notifications: [], unreadCount: 0 });
      return;
    }

    if (isDatabaseAvailable()) {
      try {
        const dbRes = await pool.query(
          `SELECT id, user_id as "userId", type, title, message, read, read_at as "readAt", created_at as "createdAt"
           FROM notifications
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 50;`,
          [userId]
        );

        const unreadRes = await pool.query(
          `SELECT COUNT(*)::int as count FROM notifications WHERE user_id = $1 AND read = false;`,
          [userId]
        );

        const list = dbRes.rows;
        const unreadCount = unreadRes.rows[0]?.count || 0;

        res.status(200).json({
          success: true,
          data: { notifications: list, unreadCount },
          notifications: list,
          unreadCount,
        });
        return;
      } catch (err: any) {
        console.warn('[NotificationController] DB fetch failed, using in-memory:', err.message);
      }
    }

    const list = NotificationController.inMemoryNotifications.get(userId) || [];
    const unreadCount = list.filter((n) => !n.read).length;

    res.status(200).json({
      success: true,
      data: { notifications: list, unreadCount },
      notifications: list,
      unreadCount,
    });
  }

  /**
   * PATCH /api/notifications/:id/read
   * Marks a notification as read.
   */
  public static async markRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    const notificationId = parseInt(req.params.id, 10);

    if (!userId || isNaN(notificationId)) {
      res.status(400).json({ success: false, error: 'Invalid notification or unauthorized.' });
      return;
    }

    const now = new Date().toISOString();

    if (isDatabaseAvailable()) {
      try {
        await pool.query(
          `UPDATE notifications SET read = true, read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2;`,
          [notificationId, userId]
        );
      } catch {
        // ignore
      }
    }

    const userNotifs = NotificationController.inMemoryNotifications.get(userId);
    if (userNotifs) {
      const notif = userNotifs.find((n) => n.id === notificationId);
      if (notif) {
        notif.read = true;
        notif.readAt = now;
      }
    }

    res.status(200).json({ success: true, status: 'success', notificationId, read: true, readAt: now });
  }

  /**
   * POST /api/notifications/read-all
   * Marks all notifications as read for current user.
   */
  public static async markAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(200).json({ success: true, status: 'success' });
      return;
    }

    const now = new Date().toISOString();

    if (isDatabaseAvailable()) {
      try {
        await pool.query(
          `UPDATE notifications SET read = true, read_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND read = false;`,
          [userId]
        );
      } catch {
        // ignore
      }
    }

    const userNotifs = NotificationController.inMemoryNotifications.get(userId);
    if (userNotifs) {
      userNotifs.forEach((n) => {
        n.read = true;
        n.readAt = now;
      });
    }

    res.status(200).json({ success: true, status: 'success' });
  }

  /**
   * Helper to insert a notification into PostgreSQL and in-memory store for a user.
   */
  public static async createNotification(
    userId: number,
    title: string,
    message: string,
    type: string = 'system'
  ): Promise<void> {
    const now = new Date().toISOString();

    // 1. In-memory append
    if (!NotificationController.inMemoryNotifications.has(userId)) {
      NotificationController.inMemoryNotifications.set(userId, []);
    }
    const notif: NotificationRecord = {
      id: NotificationController.nextNotificationId++,
      userId,
      type,
      title,
      message,
      read: false,
      createdAt: now,
    };
    NotificationController.inMemoryNotifications.get(userId)!.unshift(notif);

    // 2. Database append if available
    if (isDatabaseAvailable()) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4);`,
          [userId, type, title, message]
        );
      } catch (e: any) {
        console.warn('[NotificationController] Failed to create notification in DB:', e.message);
      }
    }
  }
}
