import React from 'react';
import ReportsOverview from '@/components/admin/reports/ReportsOverview';

const DUMMY_REPORT_DATA = {
  stats: {
    revenue: "₹12.5L",
    signups: "2,480",
    providers: "452",
    bookings: "8,924"
  },
  revenueChart: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [45, 52, 38, 65, 48, 80]
  },
  userChart: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [120, 150, 110, 180, 200, 250]
  }
};

export default function AdminReportsPage() {
  // TODO: Fetch analytics data from API
  return (
    <ReportsOverview 
      stats={DUMMY_REPORT_DATA.stats}
      revenueChartData={DUMMY_REPORT_DATA.revenueChart}
      userChartData={DUMMY_REPORT_DATA.userChart}
    />
  );
}
