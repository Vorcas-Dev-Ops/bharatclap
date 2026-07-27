import { Request, Response } from 'express';
import { Provider } from '../../models/Provider';
import { WalletAuditLog } from '../../models/WalletAuditLog';
import { WalletTransaction } from '../../models/WalletTransaction';
import { emitToUser } from '../../services/socketService';

export const createWalletAdjustmentAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, action, amount, reason, remarks } = req.body;

    if (!providerId || !action || !amount || amount <= 0 || !reason || !remarks) {
      res.status(400).json({ message: 'Mandatory fields missing: providerId, action, amount (>0), reason, and remarks are required.' });
      return;
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    if (provider.walletStatus === 'frozen_manual' || provider.walletStatus === 'frozen_auto') {
      res.status(403).json({ message: `Cannot perform wallet adjustment. Provider wallet is ${provider.walletStatus}. Super Admin unfreeze required.` });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Admin', role: 'super_admin', admin_role: 'super_admin' };
    const adminRole = adminUser.admin_role || adminUser.role || 'super_admin';
    const isSuperOrFinance = adminRole === 'super_admin' || adminRole === 'finance_admin' || adminUser.role === 'super_admin';

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const refId = `WAL-${Math.floor(100000 + Math.random() * 900000)}`;

    const isHighValue = Number(amount) > 5000;
    const requiresApproval = isHighValue && !isSuperOrFinance;

    const previousBalance = provider.walletBalance || 0;
    const isCredit = action === 'Wallet Credit' || action === 'Credit';
    const newBalance = isCredit ? previousBalance + Number(amount) : previousBalance - Number(amount);

    if (requiresApproval) {
      const auditLog = await WalletAuditLog.create({
        transactionRefId: refId,
        date: new Date(),
        adminId: adminUser._id,
        adminName: adminUser.name || 'Admin User',
        adminRole: adminRole,
        providerId: provider._id,
        providerName: (provider as any).user_id?.name || 'Service Expert',
        action: isCredit ? 'Wallet Credit' : 'Wallet Debit',
        amount: Number(amount),
        previousBalance: previousBalance,
        newBalance: previousBalance,
        reason,
        remarks,
        ipAddress: String(clientIp),
        status: 'Pending Approval',
        approvalStatus: 'pending_approval'
      });

      res.json({
        success: true,
        pendingApproval: true,
        message: `High-value adjustment (₹${Number(amount).toLocaleString('en-IN')}) requires Finance Admin / Super Admin approval. Submitted as Ref ID: ${refId}.`,
        auditLog
      });
      return;
    }

    provider.walletBalance = newBalance;
    await provider.save();

    await WalletTransaction.create({
      provider_id: provider._id,
      amount: Number(amount),
      type: isCredit ? 'credit' : 'debit',
      description: `[ADMIN ${String(action).toUpperCase()}] ${reason}: ${remarks}`,
      balance_after: newBalance,
      reference_id: refId
    });

    const auditLog = await WalletAuditLog.create({
      transactionRefId: refId,
      date: new Date(),
      adminId: adminUser._id,
      adminName: adminUser.name || 'Admin User',
      adminRole: adminRole,
      providerId: provider._id,
      providerName: (provider as any).user_id?.name || 'Service Expert',
      action: isCredit ? 'Wallet Credit' : 'Wallet Debit',
      amount: Number(amount),
      previousBalance: previousBalance,
      newBalance: newBalance,
      reason,
      remarks,
      ipAddress: String(clientIp),
      status: 'Active',
      approvalStatus: 'approved'
    });

    try {
      emitToUser(String(provider.user_id), 'wallet_balance_updated', {
        walletBalance: newBalance,
        amount: Number(amount),
        type: isCredit ? 'credit' : 'debit',
        reason,
        refId
      });
    } catch (e) {
      // Non-blocking socket notification
    }

    res.json({
      success: true,
      newBalance,
      auditLog,
      message: `Wallet ${isCredit ? 'credited' : 'debited'} ₹${Number(amount).toLocaleString('en-IN')} successfully. Ref ID: ${refId}.`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const freezeWalletAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, reason, remarks } = req.body;

    if (!providerId || !reason || !remarks) {
      res.status(400).json({ message: 'Mandatory fields missing: providerId, reason, and remarks are required for wallet freeze.' });
      return;
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Super Admin', role: 'super_admin' };
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const refId = `FRZ-${Math.floor(100000 + Math.random() * 900000)}`;

    provider.walletStatus = 'frozen_manual';
    provider.isWalletBlocked = true;
    provider.freezeDetails = {
      frozenAt: new Date(),
      frozenBy: adminUser.name || 'Super Admin',
      freezeReason: reason,
      freezeRemarks: remarks,
      freezeType: 'manual'
    };

    await provider.save();

    const auditLog = await WalletAuditLog.create({
      transactionRefId: refId,
      date: new Date(),
      adminId: adminUser._id,
      adminName: adminUser.name || 'Super Admin',
      adminRole: 'super_admin',
      providerId: provider._id,
      providerName: (provider as any).user_id?.name || 'Service Expert',
      action: 'Freeze Wallet',
      amount: 0,
      previousBalance: provider.walletBalance || 0,
      newBalance: provider.walletBalance || 0,
      reason,
      remarks,
      ipAddress: String(clientIp),
      status: 'Manual Freeze',
      approvalStatus: 'approved'
    });

    res.json({
      success: true,
      walletStatus: 'frozen_manual',
      auditLog,
      message: `Wallet for provider "${(provider as any).user_id?.name || 'Expert'}" has been manually frozen by Super Admin.`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const unfreezeWalletAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, reason, remarks } = req.body;

    if (!providerId || !reason || !remarks) {
      res.status(400).json({ message: 'Mandatory fields missing: providerId, reason, and remarks are required to unfreeze wallet.' });
      return;
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Super Admin', role: 'super_admin' };
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const refId = `UFZ-${Math.floor(100000 + Math.random() * 900000)}`;

    provider.walletStatus = 'active';
    provider.isWalletBlocked = false;
    provider.freezeDetails = {
      frozenAt: null,
      frozenBy: null,
      freezeReason: null,
      freezeRemarks: null,
      freezeType: null
    };

    await provider.save();

    const auditLog = await WalletAuditLog.create({
      transactionRefId: refId,
      date: new Date(),
      adminId: adminUser._id,
      adminName: adminUser.name || 'Super Admin',
      adminRole: 'super_admin',
      providerId: provider._id,
      providerName: (provider as any).user_id?.name || 'Service Expert',
      action: 'Unfreeze Wallet',
      amount: 0,
      previousBalance: provider.walletBalance || 0,
      newBalance: provider.walletBalance || 0,
      reason,
      remarks,
      ipAddress: String(clientIp),
      status: 'Active',
      approvalStatus: 'approved'
    });

    res.json({
      success: true,
      walletStatus: 'active',
      auditLog,
      message: `Wallet for provider "${(provider as any).user_id?.name || 'Expert'}" has been unfrozen and restored to Active by Super Admin.`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getWalletAuditLogsAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, action, search } = req.query;
    const filter: any = {};

    if (providerId) filter.providerId = providerId;
    if (action) filter.action = action;
    if (search) {
      filter.$or = [
        { transactionRefId: { $regex: search, $options: 'i' } },
        { providerName: { $regex: search, $options: 'i' } },
        { adminName: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } }
      ];
    }

    const logs = await WalletAuditLog.find(filter).sort({ createdAt: -1 }).lean();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveHighValueAdjustmentAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { auditLogId } = req.params;
    const auditLog = await WalletAuditLog.findById(auditLogId);

    if (!auditLog) {
      res.status(404).json({ message: 'Audit log request not found.' });
      return;
    }

    if (auditLog.approvalStatus !== 'pending_approval') {
      res.status(400).json({ message: 'This adjustment request is not pending approval.' });
      return;
    }

    const provider = await Provider.findById(auditLog.providerId);
    if (!provider) {
      res.status(404).json({ message: 'Provider not found.' });
      return;
    }

    const adminUser = (req as any).user || { _id: null, name: 'Finance Manager' };
    const previousBalance = provider.walletBalance || 0;
    const isCredit = auditLog.action === 'Wallet Credit';
    const newBalance = isCredit ? previousBalance + auditLog.amount : previousBalance - auditLog.amount;

    provider.walletBalance = newBalance;
    await provider.save();

    await WalletTransaction.create({
      provider_id: provider._id,
      amount: auditLog.amount,
      type: isCredit ? 'credit' : 'debit',
      description: `[HIGH-VALUE APPROVED] ${auditLog.reason}: ${auditLog.remarks}`,
      balance_after: newBalance,
      reference_id: auditLog.transactionRefId
    });

    await WalletAuditLog.collection.updateOne(
      { _id: auditLog._id },
      {
        $set: {
          approvalStatus: 'approved',
          status: 'Active',
          previousBalance,
          newBalance,
          approvedBy: adminUser._id,
          approvedByName: adminUser.name || 'Finance Manager'
        }
      }
    );

    res.json({
      success: true,
      newBalance,
      message: `High-value adjustment Ref ID ${auditLog.transactionRefId} approved and applied successfully.`
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
