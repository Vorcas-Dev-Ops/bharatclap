export interface Provider360DTO {
  _id: string;
  provider_code: string;
  name: string;
  phone: string;
  email: string;
  status: string;
  kycStatus: string;
  serviceCategory: string;
  experienceYears: number;
  rating: number;
  totalJobsCompleted: number;
  location: {
    latitude: number;
    longitude: number;
    addressName: string;
  };
  wallet: {
    balance: number;
    pendingSettlements: number;
    codCollectedToday: number;
  };
  bookings: any[];
  payouts: any[];
  reviews: any[];
  leadPackages: any[];
  performance: {
    acceptanceRate: string;
    responseRate: string;
    completionRate: string;
    onTimeArrival: string;
  };
}
