"use client";

import React from 'react';
import dynamic from 'next/dynamic';

const SettingsContent = dynamic(
  () => import('@/components/admin/settings/SettingsContent'),
  {
    loading: () => (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    ),
  }
);

export default function SettingsPage() {
  return <SettingsContent />;
}
