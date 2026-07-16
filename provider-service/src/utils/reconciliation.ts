import { Provider } from '../models/Provider';
import { WalletTransaction } from '../models/WalletTransaction';

export const startDailyReconciliation = () => {
  const runReconciliation = async () => {
    try {
      console.log('[RECONCILIATION] Daily wallet balance audit started...');
      const providers = await Provider.find({ isDeleted: false });

      for (const p of providers) {
        const transactions = await WalletTransaction.find({
          provider_id: p._id,
          status: 'success'
        }).lean();

        // 1. Calculate computed walletBalance
        const computedBalance = transactions.reduce((acc, tx) => {
          if (tx.type === 'recharge' || tx.type === 'refund') {
            return acc + tx.amount;
          } else if (tx.type === 'deduction') {
            return acc - tx.amount;
          }
          return acc;
        }, 0);

        // 2. Calculate computed reservedBalance (active holds not yet released or deducted)
        const holds = transactions.filter(t => t.type === 'hold');
        let computedReserved = 0;
        for (const hold of holds) {
          const resolved = transactions.some(t => 
            (t.type === 'release' || t.type === 'deduction') && 
            t.referenceId === hold.referenceId
          );
          if (!resolved) {
            computedReserved += hold.amount;
          }
        }

        if (computedBalance !== p.walletBalance || computedReserved !== p.reservedBalance) {
          console.warn(`[RECONCILIATION] Discrepancy for Provider ${p._id}. Wallet: cached ${p.walletBalance} vs computed ${computedBalance}, Reserved: cached ${p.reservedBalance} vs computed ${computedReserved}. Correcting...`);
          p.walletBalance = computedBalance;
          p.reservedBalance = computedReserved;
          await p.save();
        }
      }
      console.log('[RECONCILIATION] Daily wallet balance audit finished.');
    } catch (error: any) {
      console.error('[RECONCILIATION] Audit error:', error.message);
    }
  };

  // Run on start, then every 24 hours
  setTimeout(runReconciliation, 10000); // Wait 10s for database connections to settle on startup
  setInterval(runReconciliation, 24 * 60 * 60 * 1000);
};
