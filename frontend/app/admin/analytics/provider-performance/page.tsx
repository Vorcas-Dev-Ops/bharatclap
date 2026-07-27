import React from 'react';
import ProviderAnalyticsPage from '@/components/admin/analytics/ProviderAnalyticsPage';

export const metadata = {
  title: 'Provider Performance Analytics | Admin',
  description: 'Monitor dispatch success rates, latency, and top provider leaderboard',
};

export default function ProviderPerformanceAdminPage() {
  return <ProviderAnalyticsPage />;
}
