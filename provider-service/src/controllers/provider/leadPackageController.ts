import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LeadPackage } from '../../models/LeadPackage';
import { LeadPackageOrder } from '../../models/LeadPackageOrder';
import { LeadTransaction } from '../../models/LeadTransaction';
import { Provider } from '../../models/Provider';
import { recordWalletChangeAndAudit } from '../../services/walletLedgerService';
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
    let packages = await LeadPackage.find({}).sort({ sortOrder: 1, createdAt: -1 }).lean();
    if (packages.length === 0) {
      // Seed default packages if empty
      packages = await LeadPackage.insertMany([
        { name: 'Starter', price: 299, leads: 25, bonusLeads: 0, validityDays: 30, hasPriorityDispatch: false, badgeText: '', description: 'Essential starter package for new service providers.', sortOrder: 1 },
        { name: 'Basic', price: 499, leads: 60, bonusLeads: 10, validityDays: 30, hasPriorityDispatch: false, badgeText: '10 Bonus', description: 'Popular choice for active part-time service experts.', sortOrder: 2 },
        { name: 'Silver', price: 999, leads: 120, bonusLeads: 20, validityDays: 60, hasPriorityDispatch: true, badgeText: 'Best Value', description: 'Priority dispatch access with 2-month validity.', sortOrder: 3 },
        { name: 'Gold', price: 1999, leads: 300, bonusLeads: 50, validityDays: 90, hasPriorityDispatch: true, badgeText: 'Popular', description: 'High volume growth package with priority dispatch ranking.', sortOrder: 4 },
        { name: 'Festival Offer', price: 799, leads: 150, bonusLeads: 25, validityDays: 30, hasPriorityDispatch: true, badgeText: 'Festival Special', description: 'Limited time promotional package for seasonal surge.', sortOrder: 5 },
      ]) as any;
    }
    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, price, leads, bonusLeads, validityDays, hasPriorityDispatch, hasLeadExpiry, badgeText, description, isActive } = req.body;
    const newPackage = await LeadPackage.create({
      name,
      price,
      leads,
      bonusLeads: bonusLeads || 0,
      validityDays: validityDays || 30,
      hasPriorityDispatch: !!hasPriorityDispatch,
      hasLeadExpiry: hasLeadExpiry !== false,
      badgeText: badgeText || '',
      description: description || '',
      isActive: isActive !== false,
    });
    res.status(201).json({ success: true, package: newPackage });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await LeadPackage.findByIdAndUpdate(id, { $set: req.body }, { new: true });
    if (!updated) {
      res.status(404).json({ message: 'Package not found' });
      return;
    }
    res.json({ success: true, package: updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteLeadPackageAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await LeadPackage.findByIdAndDelete(id);
    res.json({ success: true, message: 'Package deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Provider Lead Package Purchase & Ledger ──────────────────────────────────

export const getActiveLeadPackages = async (req: Request, res: Response): Promise<void> => {
  try {
    const packages = await LeadPackage.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean();
    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createLeadPackagePurchaseOrder = async (req: any, res: Response): Promise<void> => {
  try {
    const { packageId } = req.body;
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const pkg = await LeadPackage.findById(packageId);
    if (!pkg || !pkg.isActive) {
      res.status(404).json({ message: 'Lead package unavailable or inactive' });
      return;
    }

    const expiresAt = pkg.validityDays > 0 ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000) : null;
    const totalLeads = pkg.leads + (pkg.bonusLeads || 0);

    // If provider has Free Trial / Free Access enabled or package is free (₹0), bypass Razorpay payment entirely
    if (provider.isFreeAccessEnabled || provider.subscriptionType === 'free_trial' || pkg.price === 0) {
      const packageOrder = await LeadPackageOrder.create({
        provider_id: provider._id,
        package_id: pkg._id,
        packageName: pkg.name,
        price: 0,
        baseLeads: pkg.leads,
        bonusLeads: pkg.bonusLeads || 0,
        totalLeadsGranted: totalLeads,
        leadsRemaining: totalLeads,
        hasPriorityDispatch: pkg.hasPriorityDispatch,
        purchasedAt: new Date(),
        expiresAt,
        paymentStatus: 'success',
        razorpayOrderId: `free_access_${Date.now()}`,
        razorpayPaymentId: `free_access_${Date.now()}`
      });

      const activeOrders = await LeadPackageOrder.find({
        provider_id: provider._id,
        paymentStatus: 'success',
        leadsRemaining: { $gt: 0 },
        $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }]
      });
      const totalLeadsAvailable = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);

      await LeadTransaction.create({
        provider_id: provider._id,
        package_order_id: packageOrder._id,
        type: 'purchase',
        leadAmount: totalLeads,
        balanceAfter: totalLeadsAvailable,
        referenceId: String(packageOrder._id),
        description: `Activated package "${pkg.name}" (${totalLeads} leads) via Free Trial Access`,
      });

      res.json({
        success: true,
        freeAccess: true,
        message: 'Lead package activated successfully with Free Access!',
        order: packageOrder
      });
      return;
    }

    // Standard Paid Purchase via Razorpay
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret || key_id.includes('dummy') || key_secret.includes('dummy')) {
      res.status(400).json({ message: 'Razorpay API keys are not properly configured on backend server.' });
      return;
    }

    const razorpay = new Razorpay({ key_id, key_secret });
    const options = {
      amount: Math.round(pkg.price * 100),
      currency: 'INR',
      receipt: `pkg_order_${Date.now()}_${String(provider._id).slice(-4)}`,
      notes: {
        provider_id: String(provider._id),
        package_id: String(pkg._id),
        packageName: pkg.name
      }
    };

    let rzpOrder;
    try {
      rzpOrder = await razorpay.orders.create(options);
    } catch (rzpErr: any) {
      console.error('[RAZORPAY ERROR] Failed to create order:', rzpErr?.error || rzpErr?.message || rzpErr);
      res.status(400).json({
        message: `Razorpay Order Creation Failed: ${rzpErr?.error?.description || rzpErr?.message || 'Invalid Razorpay Credentials'}`,
        details: rzpErr?.error || rzpErr?.message
      });
      return;
    }

    const packageOrder = await LeadPackageOrder.create({
      provider_id: provider._id,
      package_id: pkg._id,
      packageName: pkg.name,
      price: pkg.price,
      baseLeads: pkg.leads,
      bonusLeads: pkg.bonusLeads || 0,
      totalLeadsGranted: totalLeads,
      leadsRemaining: totalLeads,
      hasPriorityDispatch: pkg.hasPriorityDispatch,
      purchasedAt: new Date(),
      expiresAt,
      paymentStatus: 'pending',
      razorpayOrderId: rzpOrder.id
    });

    res.json({
      success: true,
      order: packageOrder,
      razorpayOrder: rzpOrder,
      key_id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyLeadPackagePayment = async (req: any, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const order = await LeadPackageOrder.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      res.status(404).json({ message: 'Package purchase order not found' });
      return;
    }

    // Mock payment signature bypass for dev environment
    const isMock = razorpay_order_id?.startsWith('order_mock_');
    if (!isMock && razorpay_signature) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'dummysecret12345';
      const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        res.status(400).json({ message: 'Invalid payment signature' });
        return;
      }
    }

    order.paymentStatus = 'success';
    order.razorpayPaymentId = razorpay_payment_id || `pay_mock_${Date.now()}`;
    await order.save();

    // Calculate updated total lead balance for transaction log
    const activeOrders = await LeadPackageOrder.find({
      provider_id: order.provider_id,
      paymentStatus: 'success',
      leadsRemaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }]
    });

    const totalLeadsAvailable = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);

    // Record LeadTransaction ledger
    await LeadTransaction.create({
      provider_id: order.provider_id,
      package_order_id: order._id,
      type: 'purchase',
      leadAmount: order.totalLeadsGranted,
      balanceAfter: totalLeadsAvailable,
      referenceId: String(order._id),
      description: `Purchased package "${order.packageName}" (${order.totalLeadsGranted} leads)`,
    });

    // Record wallet ledger credit for package purchase
    if (order.price > 0) {
      try {
        await recordWalletChangeAndAudit({
          providerId: order.provider_id,
          amount: order.price,
          type: 'recharge',
          action: 'Package Purchase Recharge',
          source: 'Razorpay',
          reason: `Purchased package "${order.packageName}"`,
          referenceId: String(order._id),
          paymentId: order.razorpayPaymentId
        });
      } catch (wErr) {
        console.error('[LEAD_PACKAGE] Wallet credit record warning:', wErr);
      }
    }

    res.json({ success: true, message: 'Lead package activated successfully', order });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getProviderLeadBalanceAndHistory = async (req: any, res: Response): Promise<void> => {
  try {
    const provider = await Provider.findOne({ user_id: req.user?._id });
    if (!provider) {
      res.status(404).json({ message: 'Provider not found' });
      return;
    }

    const now = new Date();
    const activeOrders = await LeadPackageOrder.find({
      provider_id: provider._id,
      paymentStatus: 'success',
      leadsRemaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
    }).sort({ purchasedAt: 1 }).lean();

    const totalLeadsRemaining = activeOrders.reduce((sum, o) => sum + o.leadsRemaining, 0);
    const hasPriorityDispatch = activeOrders.some(o => o.hasPriorityDispatch);

    const [transactions, ordersHistory] = await Promise.all([
      LeadTransaction.find({ provider_id: provider._id }).sort({ createdAt: -1 }).limit(50).lean(),
      LeadPackageOrder.find({ provider_id: provider._id }).sort({ createdAt: -1 }).limit(20).lean()
    ]);

    res.json({
      leadBalance: totalLeadsRemaining,
      hasPriorityDispatch,
      activePackages: activeOrders,
      transactions,
      ordersHistory
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Admin Lead Package Analytics & Recharge History ──────────────────────────

export const getLeadPackageDashboardStatsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();

    const [
      totalPackages,
      activePackages,
      successfulOrders,
      allProviders
    ] = await Promise.all([
      LeadPackage.countDocuments({}),
      LeadPackage.countDocuments({ isActive: true }),
      LeadPackageOrder.find({ paymentStatus: 'success' }).lean(),
      Provider.find({ isDeleted: false }).lean()
    ]);

    const totalRevenue = successfulOrders.reduce((sum, o) => sum + (o.price || 0), 0);
    const packagesSold = successfulOrders.length;

    // Calculate active leads per provider dynamically from active orders
    const providerIds = allProviders.map(p => p._id);
    const activeOrdersAll = await LeadPackageOrder.find({
      provider_id: { $in: providerIds },
      paymentStatus: 'success',
      leadsRemaining: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
    }).lean();

    const providerLeadsMap = new Map<string, number>();
    const providerPriorityMap = new Map<string, boolean>();

    for (const order of activeOrdersAll) {
      const pid = String(order.provider_id);
      const currentLeads = providerLeadsMap.get(pid) || 0;
      providerLeadsMap.set(pid, currentLeads + order.leadsRemaining);

      if (order.hasPriorityDispatch) {
        providerPriorityMap.set(pid, true);
      }
    }

    let lowLeadCount = 0;
    let zeroLeadCount = 0;
    let priorityCount = 0;

    for (const p of allProviders) {
      const leads = providerLeadsMap.get(String(p._id)) || 0;
      if (leads === 0) zeroLeadCount++;
      else if (leads <= 5) lowLeadCount++;

      if (providerPriorityMap.get(String(p._id))) priorityCount++;
    }

    const rechargeHistory = await LeadPackageOrder.find({ paymentStatus: 'success' })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('provider_id', 'user_id')
      .lean();

    res.json({
      totalPackages,
      activePackages,
      totalRevenue,
      packagesSold,
      lowLeadCount,
      zeroLeadCount,
      priorityCount,
      rechargeHistory
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
