"use client";

import dynamic from 'next/dynamic';

const RefundPolicyManager = dynamic(
  () => import('@/components/admin/refunds/RefundPolicyManager'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    ),
    ssr: false,
  }
);

export default function RefundPolicyPage() {
  return <RefundPolicyManager />;
}
