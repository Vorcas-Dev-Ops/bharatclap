"use client";

import dynamic from 'next/dynamic';

// ponytail: lazy-load the heavy dashboard component — admin pages aren't on the critical user path
const DashboardOverview = dynamic(
  () => import('@/components/admin/dashboard/DashboardOverview'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" />
      </div>
    ),
  }
);

export default function AdminDashboardPage() {
  return <DashboardOverview />;
}
