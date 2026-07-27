"use client";

import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const NetworkStatusBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] max-w-md w-full px-4 animate-bounce-short">
      {!isOnline && (
        <div className="bg-slate-900/95 backdrop-blur text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">📡</span>
            <div>
              <p className="font-semibold text-sm">No Internet Connection</p>
              <p className="text-xs text-slate-400">Please check your network settings.</p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg transition"
          >
            Retry
          </button>
        </div>
      )}

      {isOnline && wasOffline && (
        <div className="bg-emerald-900/95 backdrop-blur text-white p-4 rounded-2xl shadow-2xl border border-emerald-800 flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div>
            <p className="font-semibold text-sm">Connection Restored</p>
            <p className="text-xs text-emerald-200">Data is syncing with backend...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatusBanner;
