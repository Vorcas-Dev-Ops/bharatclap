export interface Customer360ResponseContract {
  _id: string;
  user_code: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  role: string;
  createdAt: string;
  avatar: string;
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalSpent: number;
    walletBalance: number;
    membershipTier: string;
    avgRatingGiven: number;
  };
  addresses: any[];
  bookings: any[];
  payments: any[];
  refunds: any[];
  complaints: any[];
  membership: {
    tier: string;
    active: boolean;
    expiresAt: string;
    totalSavings: number;
  };
  referral: {
    code: string;
    referredCount: number;
    totalEarnings: number;
  };
  auditLogs: any[];
}
