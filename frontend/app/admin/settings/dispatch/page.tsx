import React from 'react';
import DispatchSettingsPage from '@/components/admin/settings/DispatchSettingsPage';

export const metadata = {
  title: 'Dispatch & Load Balancing Rules | Admin',
  description: 'Configure weighted dispatch scoring, load balancing, and concurrency limits',
};

export default function DispatchSettingsAdminPage() {
  return <DispatchSettingsPage />;
}
