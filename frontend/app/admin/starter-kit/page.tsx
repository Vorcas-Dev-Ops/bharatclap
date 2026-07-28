"use client";

import dynamic from 'next/dynamic';

const StarterKitManager = dynamic(
  () => import('@/components/admin/starter-kit/StarterKitManager'),
  {
    loading: () => (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    ),
    ssr: false,
  }
);

export default function StarterKitPage() {
  return <StarterKitManager />;
}
