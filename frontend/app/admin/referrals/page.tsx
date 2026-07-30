import React from 'react';
import AdminProviderReferralsPage from '@/components/admin/referrals/AdminProviderReferralsPage';

export const metadata = {
  title: 'Provider Referrals & Audit | Admin Portal | BharatClap',
  description: 'Monitor provider referral conversions, fraud review flags, and wallet ledger payouts.',
};

export default function AdminReferralsPage() {
  return <AdminProviderReferralsPage />;
}
