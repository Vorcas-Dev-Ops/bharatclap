"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const PayoutsContent = dynamic(
  () => import('@/components/admin/payouts/PayoutsContent'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
  }
);

export default function PayoutsPage() {
    return <PayoutsContent />;
}