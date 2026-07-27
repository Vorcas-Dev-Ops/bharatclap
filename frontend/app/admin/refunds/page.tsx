"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { refundService, RefundStats } from '@/services/refund.service';

export default function AdminRefundsOverview() {
  const [stats, setStats] = useState<RefundStats>({
    totalRefundsToday: 0,
    amountRefundedToday: 0,
    pendingApproval: 0,
    processing: 0,
    failed: 0,
    walletRefunds: 0,
    gatewayRefunds: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await refundService.getStats();
        setStats(data);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Refund Management Suite</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Real-time status, dispute resolution, and immutable ledgers</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/refunds/policies"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            ⚙️ Policy Rules
          </Link>
          <Link
            href="/admin/refunds/pending"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            ⏳ Pending ({stats.pendingApproval})
          </Link>
        </div>
      </div>

      {/* Quick Nav Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs font-semibold text-slate-600">
        <Link href="/admin/refunds" className="px-3 py-1.5 bg-slate-900 text-white rounded-lg whitespace-nowrap">Overview</Link>
        <Link href="/admin/refunds/pending" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Pending Approval</Link>
        <Link href="/admin/refunds/processing" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Processing</Link>
        <Link href="/admin/refunds/completed" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Completed</Link>
        <Link href="/admin/refunds/failed" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Failed & Retries</Link>
        <Link href="/admin/refunds/disputes" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Disputes</Link>
        <Link href="/admin/refunds/provider-adjustments" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Provider Ledgers</Link>
        <Link href="/admin/refunds/wallet" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Customer Wallets</Link>
        <Link href="/admin/refunds/policies" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Policies</Link>
        <Link href="/admin/refunds/audit" className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap">Audit Logs</Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Refunds Today</p>
          <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.totalRefundsToday}</h3>
          <p className="text-xs text-slate-500 mt-1">₹{stats.amountRefundedToday.toLocaleString()} total value</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Pending Review</p>
          <h3 className="text-2xl font-black text-amber-600 mt-1">{stats.pendingApproval}</h3>
          <p className="text-xs text-slate-500 mt-1">Requires admin approval</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Wallet vs Gateway</p>
          <h3 className="text-2xl font-black text-slate-800 mt-1">{stats.walletRefunds} : {stats.gatewayRefunds}</h3>
          <p className="text-xs text-slate-500 mt-1">Instant wallet vs Razorpay</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Failed / Retries</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">{stats.failed}</h3>
          <p className="text-xs text-slate-500 mt-1">Gateway timeout retry queue</p>
        </div>
      </div>
    </div>
  );
}