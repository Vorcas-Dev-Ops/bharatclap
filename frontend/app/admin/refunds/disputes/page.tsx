"use client";

import React from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/admin/layout/AdminLayout';

export default function AdminDisputesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Customer & Provider Disputes</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Review evidence photos, service logs, and issue final rulings</p>
        </div>
        <Link href="/admin/refunds" className="text-xs font-bold text-indigo-600 hover:underline">
          ← Back to Overview
        </Link>
      </div>

      <div className="p-8 bg-white rounded-2xl border border-slate-200/80 text-center shadow-sm">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          ⚖️
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Dispute Portal Ready</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
          All customer complaints with attached evidence photos and provider response statements are queued here for admin arbitration.
        </p>
      </div>
    </div>
  );
}
