"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const ReportsOverview = dynamic(
  () => import('@/components/admin/reports/ReportsOverview'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    ),
    ssr: false,
  }
);

export default function AdminReportsPage() {
  return <ReportsOverview />;
}
