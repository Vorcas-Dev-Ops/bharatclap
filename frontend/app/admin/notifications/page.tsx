"use client";

import React, { Suspense } from 'react';
import NotificationsManager from '@/components/admin/notifications/NotificationsManager';
import { RefreshCw } from 'lucide-react';

export default function NotificationBroadcastPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading Notification Center...</p>
        </div>
      }
    >
      <NotificationsManager />
    </Suspense>
  );
}
