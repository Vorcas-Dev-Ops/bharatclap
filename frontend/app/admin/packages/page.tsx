import React from 'react';
import LeadPackagesPage from '@/components/admin/packages/LeadPackagesPage';

export const metadata = {
  title: 'Lead Package Management | Admin',
  description: 'Manage Lead Packages, Pricing, Bonus Leads, and Purchase History',
};

export default function PackagesAdminPage() {
  return <LeadPackagesPage />;
}
