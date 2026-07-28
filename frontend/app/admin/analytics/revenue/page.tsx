"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const RevenueAnalyticsContent = dynamic(
  () => import('@/components/admin/analytics/RevenueAnalyticsContent'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
    ssr: false,
  }
);

export default function RevenueAnalyticsPage() {
  return <RevenueAnalyticsContent />;
}
