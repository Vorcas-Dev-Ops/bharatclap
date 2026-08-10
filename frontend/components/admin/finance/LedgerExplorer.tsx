"use client";

import React, { useState } from 'react';
import { Search, Database, FileText, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function LedgerExplorer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'booking_id' | 'payment_id' | 'settlement_id' | 'journal_id' | 'correlation_id' | 'provider_id'>('booking_id');
  const [searchResult, setSearchResult] = useState<any>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // ponytail: mock visual representation of double-entry financial chain
    setSearchResult({
      chain: [
        { stage: 'Booking Created', id: searchQuery, detail: 'Financial Snapshot Version 1 Frozen' },
        { stage: 'Invoice Generated', id: `INV-${searchQuery.slice(-6)}`, detail: 'Base Price + GST Breakdown' },
        { stage: 'Payment Recorded', id: `PAY-${searchQuery.slice(-6)}`, detail: 'Status: Paid (paid_via = Online)' },
        { stage: 'Payment Attempt', id: `ATT-1`, detail: 'Razorpay Authorized & Captured' },
        { stage: 'Journal Entry Written', id: `JRN-${searchQuery.slice(-6)}`, detail: 'Debit Cash / Credit Revenue' },
        { stage: 'Payment Ledger Created', id: `LDG-PAY-${searchQuery.slice(-6)}`, detail: 'Double Entry Balance Checked' },
        { stage: 'Settlement Created', id: `SETTL-${searchQuery.slice(-6)}`, detail: 'Status: Created -> On Hold (3 Days)' },
        { stage: 'Bank Payout Batch', id: `BATCH-2026-08`, detail: 'Transferred via RazorpayX' }
      ]
    });
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Ledger Explorer</h1>
        <p className="text-xs text-gray-500 font-medium">Trace the Full Immutable Double-Entry Accounting Chain from Booking to Bank Transfer</p>
      </div>

      <form onSubmit={handleSearch} className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <select
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as any)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700"
        >
          <option value="booking_id">Booking ID</option>
          <option value="payment_id">Payment ID</option>
          <option value="settlement_id">Settlement ID</option>
          <option value="journal_id">Journal ID</option>
          <option value="correlation_id">Correlation ID</option>
          <option value="provider_id">Provider ID</option>
        </select>

        <input
          type="text"
          placeholder={`Enter ${searchType.replace('_', ' ').toUpperCase()}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2">
          <Search size={14} />
          Inspect Chain
        </button>
      </form>

      {searchResult && (
        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            Immutable Financial Chain Trace
          </h3>

          <div className="space-y-3">
            {searchResult.chain.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-white/80 border rounded-xl shadow-xs">
                <div className="w-7 h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-xs">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-900">{item.stage}</h4>
                  <p className="text-[10px] text-gray-400 font-mono">Ref: {item.id}</p>
                </div>
                <span className="text-xs font-medium text-gray-500">{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
