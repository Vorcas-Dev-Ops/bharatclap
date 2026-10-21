"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const KitCollectionTab = dynamic(
  () => import('@/components/admin/starter-kit/tabs/KitCollectionTab'),
  {
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    ),
    ssr: false,
  }
);

export default function KitCollectionAdminPage() {
  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-4 p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 py-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Provider Kit Collection</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Manage Hub pickup address, verify visiting providers, and confirm kit collection handovers.
          </p>
        </div>
      </div>
      <KitCollectionTab />
    </div>
  );
}
