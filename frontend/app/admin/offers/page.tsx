import React from 'react';
import dynamic from 'next/dynamic';

const OffersManagement = dynamic(
  () => import('../../../components/admin/offers/OffersManagement'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
  }
);

export default function OffersPage() {
  return <OffersManagement />;
}
