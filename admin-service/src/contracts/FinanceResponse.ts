export interface FinanceResponseContract {
  revenueToday: number;
  platformCommission: number;
  gstCollected: number;
  tdsDeducted: number;
  tcsDeducted: number;
  pendingSettlements: number;
  failedPayments: number;
  refundQueue: number;
  walletLiabilities: number;
}
