"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { refundService, PendingRefundItem } from '@/services/refund.service';
import EmptyState from '@/components/common/EmptyState';

export default function PendingRefundsPage() {
  const [pendingItems, setPendingItems] = useState<PendingRefundItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPending = async () => {
    try {
      setLoading(true);
      const items = await refundService.getPending();
      setPendingItems(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const success = await refundService.processAction(id, action);
    if (success) {
      setPendingItems(prev => prev.filter(item => item.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Pending Refund Approvals</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manual review required for disputes and high-value cancellations</p>
        </div>
        <Link href="/admin/refunds" className="text-xs font-bold text-indigo-600 hover:underline">
          ← Back to Overview
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold animate-pulse">Loading pending cases...</div>
      ) : pendingItems.length === 0 ? (
        <EmptyState
          title="No Pending Refunds"
          description="All refund requests have been processed or auto-approved."
          actionText="Back to Overview"
          onAction={() => window.location.href = '/admin/refunds'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Refund ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Provider</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Reason</th>
                <th className="p-4">SLA Timer</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {pendingItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-mono font-bold text-indigo-600">{item.id}</td>
                  <td className="p-4">{item.customer}</td>
                  <td className="p-4">{item.provider}</td>
                  <td className="p-4 font-bold text-slate-900">₹{item.amount}</td>
                  <td className="p-4 max-w-xs truncate">{item.reason}</td>
                  <td className="p-4"><span className="px-2 py-1 bg-amber-50 text-amber-600 rounded font-bold">{item.slaMinutesLeft}m left</span></td>
                  <td className="p-4 space-x-2">
                    <button
                      onClick={() => handleAction(item.id, 'approve')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(item.id, 'reject')}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition"
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
