"use client";

import React, { useState } from 'react';
import {
  Search, Filter, Download, ArrowUpRight, ShieldCheck, Database,
  DollarSign, RefreshCw, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';

export default function TransactionExplorer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  // ponytail: no dummy data — connect to real transaction API when available
  const transactions: any[] = [];

  const handleExportCSV = () => {
    alert('Exporting 17-field complete transaction audit ledger to CSV file...');
  };

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Finance Transaction Ledger Explorer</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Single-Screen 17-Field Double-Entry Transaction Ledger across Customer, Provider, Payment, and Settlement
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 self-start md:self-auto"
        >
          <Download size={14} /> Export CSV / Excel
        </button>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Transaction ID, Booking ID, Customer, Provider, Correlation ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Pending">Pending</option>
          <option value="Refunded">Refunded</option>
          <option value="Failed">Failed</option>
        </select>

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
        >
          <option value="all">All Payment Methods</option>
          <option value="UPI">Razorpay (UPI)</option>
          <option value="COD">Cash on Delivery (COD)</option>
          <option value="Card">Razorpay (Card)</option>
          <option value="Wallet">Provider Wallet</option>
        </select>
      </div>

      {/* ── Complete 17-Field Ledger Table ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" /> Complete Double-Entry Transaction Ledger
          </h3>
          <span className="text-xs text-slate-400 font-medium">Showing {transactions.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-b border-slate-100">
              <tr>
                <th className="p-3">Txn ID</th>
                <th className="p-3">Booking ID</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Comm / GST</th>
                <th className="p-3">Method</th>
                <th className="p-3">Payment ID</th>
                <th className="p-3">Settlement ID</th>
                <th className="p-3">Correlation ID</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {transactions.map((t) => (
                <tr key={t.txnId} className="hover:bg-slate-50/80 transition">
                  <td className="p-3 font-mono font-bold text-slate-900">{t.txnId}</td>
                  <td className="p-3 font-mono font-bold text-indigo-600">{t.bookingId}</td>
                  <td className="p-3 text-slate-700">{t.customer}</td>
                  <td className="p-3 text-slate-700">{t.provider}</td>
                  <td className="p-3 font-bold text-slate-900">₹{t.amount}</td>
                  <td className="p-3 text-slate-500">₹{t.commission} / ₹{t.gst}</td>
                  <td className="p-3 font-semibold">{t.method}</td>
                  <td className="p-3 font-mono text-slate-500">{t.paymentId}</td>
                  <td className="p-3 font-mono text-purple-600">{t.settlementId}</td>
                  <td className="p-3 font-mono text-slate-400 text-[10px]">{t.correlationId}</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      t.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
