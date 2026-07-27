"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { refundService, RefundPolicyRule } from '@/services/refund.service';

export default function ConfigurablePoliciesPage() {
  const [policies, setPolicies] = useState<RefundPolicyRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPolicies() {
      try {
        setLoading(true);
        const data = await refundService.getPolicies();
        setPolicies(data);
      } finally {
        setLoading(false);
      }
    }
    loadPolicies();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Configurable Refund Policies</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Category-specific cancellation rules, compensation fees, and refund percentages</p>
        </div>
        <Link href="/admin/refunds" className="text-xs font-bold text-indigo-600 hover:underline">
          ← Back to Overview
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold animate-pulse">Loading policies from database...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          {policies.map((p) => (
            <div key={p.category} className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-800">{p.category}</h3>
                <p className="text-xs text-slate-500">Early window: {p.earlyCancellationHours}h | Refund: {p.refundPercentage}% | Provider Fee: ₹{p.providerCompensation}</p>
              </div>
              <button
                onClick={() => alert(`Policy configuration editor for ${p.category} active.`)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition"
              >
                Edit Rules
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
