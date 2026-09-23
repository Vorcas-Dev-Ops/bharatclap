import { Request, Response } from 'express';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { ProviderServiceRepository } from '../../repositories/providerServiceRepository';
import { emitToUser } from '../../services/socketService';
import { getUsersBatch, sendAdminNotification, checkActiveBookingByProvider, sendProviderNotification } from '../../utils/internalApi';
import { initializeProviderWalletOnce } from '../../services/walletLedgerService';
import axios from 'axios';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

// @desc    Get all providers
// @route   GET /api/providers
// @access  Private/Admin
export const getProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const page  = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Number(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (status === 'available') {
      conditions.push(`availability_status = 'available' AND is_busy = FALSE`);
    } else if (status === 'busy') {
      conditions.push(`is_busy = TRUE`);
    } else if (status === 'offline') {
      conditions.push(`availability_status = 'offline'`);
    } else if (status && status !== 'all') {
      params.push(status);
      conditions.push(`kyc_status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(provider_code ILIKE $${params.length} OR id::text ILIKE $${params.length})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await db.query(
      `SELECT COUNT(*)::int as total FROM provider.providers ${whereClause}`,
      params
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const queryParams = [...params, limit, offset];
    const dataRes = await db.query(
      `SELECT p.*,
              b.account_holder_name, b.account_number_last4, b.ifsc_code, b.bank_name, b.status as bank_status
       FROM provider.providers p
       LEFT JOIN provider.provider_bank_details b ON b.provider_id = p.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
      queryParams
    );

    const providers = dataRes.rows;
    const userIds = [...new Set(providers.map(p => String(p.user_id)).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, any>(users.map((u: any) => [String(u.id || u._id), u]));

    const enriched = providers.map(p => {
      const u = userMap.get(String(p.user_id));
      return {
        ...p,
        _id: p.id,
        user_id: u ?? p.user_id,
        name: u?.name || `Provider ${p.provider_code || p.id.slice(-6)}`,
        email: u?.email || 'N/A',
        phone: u?.phone || u?.mobile || 'N/A',
        walletBalance: Number(p.wallet_balance) || 0,
        reservedBalance: Number(p.reserved_balance) || 0,
        creditLimit: Number(p.credit_limit) || 0
      };
    });

    res.json({
      providers: enriched,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get batch of providers
// @route   POST /api/providers/batch
// @access  Public (Internal)
export const getProvidersBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const providers = await ProviderRepository.findByIds(ids);
    const userIds = [...new Set(providers.map(p => p.user_id).filter(Boolean))];
    const users = userIds.length ? await getUsersBatch(userIds) : [];
    const userMap = new Map(users.map((u: any) => [String(u.id || u._id), u]));

    const enriched = providers.map(p => {
      const u: any = userMap.get(p.user_id);
      return {
        ...p,
        user_id: u ?? p.user_id,
        name: u?.name || `Provider ${p.provider_code || p.id.slice(-6)}`,
        email: u?.email || 'N/A',
        phone: u?.phone || 'N/A'
      };
    });

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get providers by user_ids (Internal API)
// @route   POST /api/providers/by-user-ids
// @access  Public (Internal)
export const getProvidersByUserIds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userIds } = req.body;
    if (!userIds || !Array.isArray(userIds)) {
      res.status(400).json({ message: 'Please provide an array of userIds' });
      return;
    }
    const providers = await ProviderRepository.findByIds(userIds);
    res.json(providers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get provider count stats (Internal API)
// @route   GET /api/providers/stats
// @access  Public (Internal)
export const getProviderStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const resRow = await db.query(
      `SELECT 
         COUNT(*)::int as total,
         COUNT(*) FILTER (WHERE kyc_status = 'pending')::int as pending,
         COUNT(*) FILTER (WHERE kyc_status = 'verified')::int as verified
       FROM provider.providers
       WHERE deleted_at IS NULL`
    );
    const row = resRow.rows[0] || {};
    res.json({
      total: Number(row.total) || 0,
      pending: Number(row.pending) || 0,
      verified: Number(row.verified) || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single provider by ID
// @route   GET /api/providers/:id
// @access  Private/Admin
export const getProviderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findById(req.params.id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const users = await getUsersBatch([provider.user_id]);
    const user = users.length ? users[0] : null;

    res.json({
      ...provider,
      user_id: user ?? provider.user_id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a provider profile
// @route   POST /api/providers
// @access  Private/Admin
export const createProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { name, email, phone, password, profile_image, availability_status } = req.body;

    let user_id = req.body.user_id;

    if (!user_id && email && password) {
      try {
        const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://127.0.0.1:5001';
        const registerRes = await axios.post(`${AUTH_URL}/api/users/register`, {
          name, email, phone, password, role: 'provider', profile_image
        });
        user_id = registerRes.data?.id || registerRes.data?._id;
      } catch (err: any) {
        res.status(400).json({ message: err.response?.data?.message || 'Failed to create user account' });
        return;
      }
    }

    if (!user_id) {
      res.status(400).json({ message: 'User ID or account credentials required' });
      return;
    }

    const existing = await ProviderRepository.findByUserId(String(user_id));
    if (existing) {
      res.status(400).json({ message: 'Provider profile already exists for this user' });
      return;
    }

    const insertRes = await db.query(
      `INSERT INTO provider.providers (
         user_id, availability_status, kyc_status, onboarding_status, is_verified
       ) VALUES ($1, COALESCE($2, 'offline'), 'pending', 'DRAFT', FALSE)
       RETURNING *`,
      [user_id, availability_status]
    );

    const provider = insertRes.rows[0];
    await initializeProviderWalletOnce(provider.id, 0);

    const users = await getUsersBatch([String(user_id)]);
    const user = users.length ? users[0] : null;

    sendAdminNotification(
      'New Provider Registration',
      `A new provider (${user?.name || email}) has registered and is pending verification.`,
      'system_alert',
      { provider_id: provider.id }
    ).catch(console.error);

    res.status(201).json({
      ...provider,
      _id: provider.id,
      user_id: user ?? provider.user_id,
      services: []
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a provider profile
// @route   PUT /api/providers/:id
// @access  Private/Admin
export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const provider = await ProviderRepository.findById(req.params.id);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { availability_status, is_verified, status, kyc_rejection_reason } = req.body;

    const updates: string[] = ['updated_at = NOW()'];
    const values: any[] = [provider.id];

    if (availability_status !== undefined) {
      values.push(availability_status);
      updates.push(`availability_status = $${values.length}`);
    }
    if (is_verified !== undefined) {
      values.push(Boolean(is_verified));
      updates.push(`is_verified = $${values.length}`);
    }
    if (status !== undefined) {
      values.push(status);
      updates.push(`kyc_status = $${values.length}`);
      if (status === 'verified') {
        updates.push(`is_verified = TRUE`);
      } else if (status === 'rejected') {
        updates.push(`is_verified = FALSE`);
      }
    }

    const updateRes = await db.query(
      `UPDATE provider.providers SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    const updated = updateRes.rows[0];

    if (status && status !== provider.kyc_status && provider.user_id) {
      const bUserId = provider.user_id;
      if (status === 'verified') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Approved',
          'Congratulations! Your profile verification has been approved.',
          'system_alert',
          { kyc_status: 'verified' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send verification notification:', err));
      } else if (status === 'rejected') {
        sendProviderNotification(
          bUserId,
          'Profile Verification Rejected',
          `Unfortunately, your profile verification was rejected. Reason: ${kyc_rejection_reason || 'Documents did not meet our verification standards.'}`,
          'system_alert',
          { kyc_status: 'rejected' }
        ).catch(err => console.error('[NOTIFICATION] Failed to send rejection notification:', err));
      }
    }

    const users = await getUsersBatch([provider.user_id]);
    const user = users.length ? users[0] : null;
    const services = await ProviderServiceRepository.getServicesForProvider(provider.id);

    res.json({
      ...updated,
      _id: updated.id,
      user_id: user ?? provider.user_id,
      services
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a provider profile
// @route   DELETE /api/providers/:id
// @access  Private/Admin
export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const delRes = await db.query(
      `UPDATE provider.providers
       SET deleted_at = NOW(),
           status = 'blocked',
           availability_status = 'offline'
       WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [req.params.id]
    );

    if (delRes.rowCount === 0) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    await db.query(
      `UPDATE provider.provider_services
       SET is_active = FALSE
       WHERE provider_id::text = $1`,
      [req.params.id]
    );

    res.json({ message: 'Provider profile and associated services removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const socketEmitInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, event, data } = req.body;
    emitToUser(userId, event, data);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getActiveSubservices = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const resRow = await db.query(
      `SELECT DISTINCT pss.subservice_id::text
       FROM provider.provider_service_subservices pss
       INNER JOIN provider.provider_services ps ON ps.id = pss.provider_service_id
       WHERE ps.is_active = TRUE`
    );
    res.status(200).json({ subservice_ids: resRow.rows.map(r => r.subservice_id) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const releaseProviderAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { force } = req.body;
    const providerId = req.params.id;

    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({ success: false, message: 'Provider not found' });
      return;
    }

    if (provider.is_busy && force !== true) {
      const hasActive = await checkActiveBookingByProvider(providerId);
      if (hasActive) {
        res.status(409).json({
          success: false,
          warning: true,
          message: 'Provider has an active booking. Are you sure you want to release them?'
        });
        return;
      }
    }

    await db.query(
      `UPDATE provider.providers
       SET availability_status = 'available',
           is_busy = FALSE,
           updated_at = NOW()
       WHERE id = $1`,
      [provider.id]
    );

    res.json({ success: true, message: 'Provider released successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDispatchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { bookingId } = req.params;

    const reqRes = await db.query(
      `SELECT jr.*, p.user_id
       FROM provider.job_requests jr
       LEFT JOIN provider.providers p ON p.id = jr.provider_id
       WHERE jr.booking_id::text = $1
       ORDER BY jr.created_at DESC`,
      [bookingId]
    );

    const jobRequests = reqRes.rows;
    const providerUserIds = jobRequests.map((jr: any) => String(jr.user_id)).filter(Boolean);
    const users = providerUserIds.length ? await getUsersBatch(providerUserIds) : [];
    const userMap = new Map<string, any>(users.map((u: any) => [String(u.id || u._id), u]));

    const history = jobRequests.map((jr: any) => {
      const user = jr.user_id ? userMap.get(String(jr.user_id)) : null;
      return {
        _id: jr.id,
        provider_id: jr.provider_id,
        provider_name: user?.name || 'Unknown Provider',
        provider_phone: user?.phone || 'N/A',
        status: jr.status,
        sent_at: jr.offered_at || jr.created_at,
        expired_at: jr.responded_at,
      };
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getKitPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const ordRes = await db.query(
      `SELECT po.*, p.user_id
       FROM provider.provider_orders po
       LEFT JOIN provider.providers p ON p.id = po.provider_id
       ORDER BY po.created_at DESC`
    );
    const orders = ordRes.rows;

    const userIds = [...new Set(orders.map(o => String(o.user_id)).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u.id || u._id), u]));

    const enrichedOrders = orders.map(order => {
      const user = order.user_id ? userMap.get(String(order.user_id)) : null;
      return {
        _id: order.id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        paymentStatus: order.status,
        amount: Number(order.total_amount),
        grandTotal: Number(order.total_amount),
        createdAt: order.created_at,
      };
    });

    const paidOrders = orders.filter(o => o.status === 'paid');
    const stats = {
      totalKitsSold: paidOrders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      totalRevenue: paidOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    };

    res.json({ stats, orders: enrichedOrders });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getKitTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const pRes = await db.query(
      `SELECT p.id, p.user_id, p.created_at, po.status as order_status, po.created_at as purchase_date
       FROM provider.providers p
       LEFT JOIN provider.provider_orders po ON po.provider_id = p.id
       WHERE p.deleted_at IS NULL`
    );
    const providers = pRes.rows;
    const userIds = [...new Set(providers.map(p => String(p.user_id)).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u.id || u._id), u]));

    const enrichedProviders = providers.map(p => {
      const user = p.user_id ? userMap.get(String(p.user_id)) : null;
      const status = p.order_status === 'paid' ? 'Purchased' : (p.order_status === 'pending' ? 'Pending Payment' : 'Not Purchased');
      return {
        _id: p.id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        status,
        purchaseDate: p.purchase_date,
      };
    });

    const stats = {
      purchased: enrichedProviders.filter(p => p.status === 'Purchased').length,
      pendingPayment: enrichedProviders.filter(p => p.status === 'Pending Payment').length,
      notPurchased: enrichedProviders.filter(p => p.status === 'Not Purchased').length,
    };

    res.json({ stats, providers: enrichedProviders });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getKitPickups = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const ordRes = await db.query(
      `SELECT po.*, p.user_id
       FROM provider.provider_orders po
       LEFT JOIN provider.providers p ON p.id = po.provider_id
       WHERE po.status = 'paid'
       ORDER BY po.updated_at DESC`
    );
    const orders = ordRes.rows;

    const userIds = [...new Set(orders.map(o => String(o.user_id)).filter(Boolean))];
    const users = await getUsersBatch(userIds);
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u.id || u._id), u]));

    const enrichedOrders = orders.map(order => {
      const user = order.user_id ? userMap.get(String(order.user_id)) : null;
      return {
        _id: order.id,
        providerId: order.provider_id,
        providerName: user?.name || 'Unknown',
        providerPhone: user?.phone || '',
        amount: Number(order.total_amount),
        createdAt: order.created_at,
      };
    });

    res.json(enrichedOrders);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateKitPickupStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { fulfillmentStatus } = req.body;

    const ordRes = await db.query(
      `UPDATE provider.provider_orders
       SET status = COALESCE($2, status),
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id, fulfillmentStatus]
    );

    if (ordRes.rows.length === 0) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.json({ success: true, order: ordRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubscriptionPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const polRes = await db.query(`SELECT * FROM provider.subscription_policies ORDER BY created_at ASC`);
    res.json(polRes.rows.map(p => ({ ...p, _id: p.id })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const upsertSubscriptionPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { tier, rules, pricing } = req.body;
    const polRes = await db.query(
      `INSERT INTO provider.subscription_policies (tier, rules, pricing)
       VALUES ($1, $2::jsonb, $3::jsonb)
       RETURNING *`,
      [tier || 'default', JSON.stringify(rules || {}), JSON.stringify(pricing || {})]
    );
    res.json({ success: true, policy: polRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateProviderSubscriptionAdmin = async (req: any, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { subscriptionType, accessMode } = req.body;

    const updRes = await db.query(
      `UPDATE provider.providers
       SET subscription_type = $2,
           access_mode = $3,
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id, subscriptionType || 'standard', accessMode || 'standard']
    );

    if (updRes.rows.length === 0) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    res.json({ success: true, provider: updRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubscriptionDashboardStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const statsRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE subscription_type = 'wallet_based' OR subscription_type IS NULL)::int as wallet_based,
         COUNT(*) FILTER (WHERE subscription_type = 'free_trial')::int as free_trial,
         COUNT(*) FILTER (WHERE access_mode = 'premium')::int as premium,
         COUNT(*) FILTER (WHERE access_mode = 'sponsored')::int as sponsored
       FROM provider.providers
       WHERE deleted_at IS NULL`
    );
    const row = statsRes.rows[0] || {};
    res.json({
      walletBased: Number(row.wallet_based) || 0,
      freeTrial: Number(row.free_trial) || 0,
      premium: Number(row.premium) || 0,
      sponsored: Number(row.sponsored) || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProviderAuditLogsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { providerId } = req.params;
    const logsRes = await db.query(
      `SELECT * FROM provider.wallet_audit_logs
       WHERE provider_id::text = $1 OR legacy_mongo_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [providerId]
    );
    res.json(logsRes.rows);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletCenterStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const statsRes = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE wallet_balance < 100)::int as low_balance,
         COUNT(*) FILTER (WHERE is_dispatch_blocked_by_cod = TRUE)::int as blocked_cod
       FROM provider.providers
       WHERE deleted_at IS NULL`
    );
    const row = statsRes.rows[0] || {};
    res.json({
      lowBalanceCount: Number(row.low_balance) || 0,
      blockedCodCount: Number(row.blocked_cod) || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const searchProvidersInternal = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { keyword, userIds } = req.body;
    const conditions: string[] = ['deleted_at IS NULL'];
    const params: any[] = [];

    if (Array.isArray(userIds) && userIds.length > 0) {
      params.push(userIds);
      conditions.push(`user_id::text = ANY($${params.length})`);
    }

    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      params.push(`%${keyword.trim()}%`);
      conditions.push(`(provider_code ILIKE $${params.length} OR id::text ILIKE $${params.length})`);
    }

    const resData = await db.query(
      `SELECT id, user_id, provider_code, availability_status FROM provider.providers
       WHERE ${conditions.join(' AND ')}
       LIMIT 100`,
      params
    );

    res.json(resData.rows.map(r => ({ ...r, _id: r.id })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
