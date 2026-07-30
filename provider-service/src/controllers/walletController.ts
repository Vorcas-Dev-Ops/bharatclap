/**
 * @deprecated LEGACY WALLET CONTROLLER
 *
 * This controller uses the old `Wallet` model (separate collection) which has
 * a `balance` field that is NEVER updated by any business logic. All real wallet
 * operations now use `Provider.walletBalance` via `walletLedgerService`.
 *
 * Status:
 *   - GET  /api/wallets/me   — no frontend callers. Safe to remove once confirmed.
 *   - POST /api/wallets/withdraw — stub only; never implemented.
 *
 * Do NOT add new logic here. Route new wallet needs to:
 *   provider-service/src/controllers/provider/walletController.ts
 *   provider-service/src/services/walletLedgerService.ts
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';

export const getMyWallet = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(410).json({
    message: 'This endpoint is deprecated. Use GET /api/providers/wallet/balance instead.',
    upgrade: '/api/providers/wallet/balance',
  });
};

export const withdrawMoney = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.status(410).json({
    message: 'This endpoint is deprecated and not implemented.',
  });
};
