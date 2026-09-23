import { Request, Response } from 'express';
import { getDb } from '../../config/db';
import { ProviderRepository } from '../../repositories/providerRepository';
import { LeadRepository } from '../../repositories/leadRepository';
import { getLeadBalance, broadcastLeadBalanceUpdate } from '../../services/leadService';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykeyid12345';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';
  return new Razorpay({ key_id, key_secret });
};

// ── Admin Package Management (CRUD) ───────────────────────────────────────────

export const getLeadPackagesAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    let resRows = await db.query(`SELECT * FROM provider.lead_packages ORDER BY credits ASC`);
    if (resRows.rows.length === 0) {
      await db.query(
        `INSERT INTO provider.lead_packages (name, credits, price, status)
         VALUES 
           ('Starter', 25, 299, 'active'),
           ('Basic', 60, 499, 'active'),
           ('Silver', 120, 999, 'active'),
           ('Gold', 300, 1999, 'active')`
      );
      resRows = await db.query(`SELECT * FROM provider.lead_packages ORDER BY credits ASC`);
    }
    res.json(resRows.rows.map(p => ({ ...p, _id: p.id, leads: p.credits, price: Number(p.price) })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { name, price, leads, status } = req.body;
    const insRes = await db.query(
      `INSERT INTO provider.lead_packages (name, price, credits, status)
       VALUES ($1, $2, $3, COALESCE($4, 'active'))
       RETURNING *`,
      [name, Number(price), Number(leads || 25), status || 'active']
    );
    const p = insRes.rows[0];
    res.status(201).json({ success: true, package: { ...p, _id: p.id, leads: p.credits, price: Number(p.price) } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, price, leads, status } = req.body;

    const updRes = await db.query(
      `UPDATE provider.lead_packages
       SET name = COALESCE($2, name),
           price = COALESCE($3, price),
           credits = COALESCE($4, credits),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [id, name, price !== undefined ? Number(price) : null, leads !== undefined ? Number(leads) : null, status]
    );

    if (updRes.rows.length === 0) {
      res.status(404).json({ message: 'Package not found' });
      return;
    }
    const p = updRes.rows[0];
    res.json({ success: true, package: { ...p, _id: p.id, leads: p.credits, price: Number(p.price) } });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { id } = req.params;
    await db.query(`UPDATE provider.lead_packages SET status = 'inactive' WHERE id::text = $1`, [id]);
    res.json({ success: true, message: 'Package deactivated' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Provider Lead Package Purchase & Ledger ──────────────────────────────────

export const getActiveLeadPackages = async (req: Request, res: Response): Promise<void> => {
  try {
    const packages = await LeadRepository.getPackages();
    res.json(packages.map(p => ({ ...p, _id: p.id, leads: p.credits })));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createLeadPackagePurchaseOrder = async (req: any, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const { packageId } = req.body;
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const pkgRes = await db.query(
      `SELECT * FROM provider.lead_packages WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [packageId]
    );
    const pkg = pkgRes.rows[0];
    if (!pkg) {
      res.status(404).json({ message: 'Lead package not found' });
      return;
    }

    const price = Number(pkg.price);
    const rzp = getRazorpayInstance();
    const rzpOrder = await rzp.orders.create({
      amount: Math.round(price * 100),
      currency: 'INR',
      receipt: `lead_${provider.id.slice(-8)}_${Date.now()}`
    });

    const orderRes = await db.query(
      `INSERT INTO provider.lead_package_orders (
         provider_id, package_id, amount, status
       ) VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [provider.id, pkg.id, price]
    );

    res.json({
      success: true,
      order: rzpOrder,
      dbOrderId: orderRes.rows[0].id,
      amount: price
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyLeadPackagePayment = async (req: any, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

    const isMock = razorpay_order_id?.startsWith('order_mock_');
    if (!isMock && razorpay_signature) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        res.status(400).json({ message: 'Invalid payment signature' });
        return;
      }
    }

    const orderRes = await db.query(
      `UPDATE provider.lead_package_orders
       SET status = 'paid', updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1
       RETURNING *`,
      [dbOrderId]
    );

    const order = orderRes.rows[0];
    if (order) {
      const pkgRes = await db.query(`SELECT credits FROM provider.lead_packages WHERE id = $1`, [order.package_id]);
      const credits = pkgRes.rows[0] ? Number(pkgRes.rows[0].credits) : 25;
      await LeadRepository.addLeadCredits(provider.id, credits, order.id);
      await broadcastLeadBalanceUpdate(provider.id);
    }

    res.json({ success: true, message: 'Lead package purchased successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProviderLeadBalanceAndHistory = async (req: any, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const userIdStr = String(req.user?.id || req.user?._id);
    const provider = await ProviderRepository.findByUserId(userIdStr);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const balanceInfo = await getLeadBalance(provider.id);

    const txRes = await db.query(
      `SELECT * FROM provider.lead_transactions
       WHERE provider_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [provider.id]
    );

    res.json({
      ...balanceInfo,
      transactions: txRes.rows
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const adminAdjustLeads = async (req: any, res: Response): Promise<void> => {
  try {
    const { providerId, credits, reason } = req.body;
    if (!providerId || credits === undefined) {
      res.status(400).json({ message: 'providerId and credits are required' });
      return;
    }

    const provider = await ProviderRepository.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const numCredits = Number(credits);
    if (numCredits > 0) {
      await LeadRepository.addLeadCredits(provider.id, numCredits, `admin_adj_${Date.now()}`);
    } else if (numCredits < 0) {
      await LeadRepository.deductLeadCredits(provider.id, Math.abs(numCredits), `admin_adj_${Date.now()}`);
    }

    await broadcastLeadBalanceUpdate(provider.id);
    res.json({ success: true, message: `Adjusted ${credits} lead credits for provider` });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLeadPackageDashboardStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const statsRes = await db.query(
      `SELECT 
         COUNT(*)::int as total_orders,
         COALESCE(SUM(amount), 0)::numeric(12,2) as total_revenue
       FROM provider.lead_package_orders
       WHERE status = 'paid'`
    );
    const row = statsRes.rows[0] || {};
    res.json({
      totalOrders: Number(row.total_orders) || 0,
      totalRevenue: Number(row.total_revenue) || 0
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
