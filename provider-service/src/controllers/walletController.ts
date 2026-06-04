import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { Wallet } from '../models/Wallet';
import { Provider } from '../models/Provider';

// @desc    Get provider wallet data
// @route   GET /api/wallets/me
// @access  Private/Provider
export const getMyWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let provider = await Provider.findOne({ user_id: req.user?._id });
    
    // Auto-create provider profile if missing but user has provider role
    if (!provider && req.user?.role === 'provider') {
      provider = await Provider.create({
        user_id: req.user._id,
        availability_status: 'offline',
        kyc_status: 'pending',
        is_verified: false,
      });
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    let wallet = await Wallet.findOne({ provider_id: provider._id });

    // If wallet doesn't exist, create one
    if (!wallet) {
      wallet = await Wallet.create({
        provider_id: provider._id,
        balance: 0,
        transactions: []
      });
    }

    res.json(wallet);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Withdraw money (placeholder)
// @route   POST /api/wallets/withdraw
// @access  Private/Provider
export const withdrawMoney = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    let provider = await Provider.findOne({ user_id: req.user?._id });
    
    // Auto-create provider profile if missing but user has provider role
    if (!provider && req.user?.role === 'provider') {
      provider = await Provider.create({
        user_id: req.user._id,
        availability_status: 'offline',
        kyc_status: 'pending',
        is_verified: false,
      });
    }

    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found' });
      return;
    }

    const wallet = await Wallet.findOne({ provider_id: provider._id });
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    if (wallet.balance < amount) {
      res.status(400).json({ message: 'Insufficient balance' });
      return;
    }

    // Process withdrawal (mock)
    wallet.balance -= amount;
    wallet.transactions.push({
      amount,
      type: 'debit',
      transaction_type: 'withdrawal',
      description: 'Bank Withdrawal',
      status: 'completed',
      createdAt: new Date()
    });

    await wallet.save();
    res.json(wallet);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
