"use client";

import dynamic from 'next/dynamic';

const ProviderTable = dynamic(
  () => import('@/components/admin/providers/ProviderTable'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" />
      </div>
    ),
  }
);

export default function ProvidersPage() {
  return <ProviderTable />;
}
