export interface DashboardResponseContract {
  totalCustomers: number;
  totalProviders: number;
  onlineProviders: number;
  activeBookings: number;
  totalRevenueToday: number;
  walletLiabilities: number;
  pendingSettlements: number;
  pendingRefunds: number;
}
