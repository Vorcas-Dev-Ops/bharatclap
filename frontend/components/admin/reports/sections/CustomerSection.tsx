"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { Users, UserPlus, RefreshCw, Crown } from 'lucide-react';

export default function CustomerSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) return null;

  const { customer } = data;

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Customer Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">New Customers</p>
            <p className="text-3xl font-black text-slate-900">{customer.new.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <UserPlus size={24} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Repeat Customers</p>
            <p className="text-3xl font-black text-slate-900">{customer.repeat.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <RefreshCw size={24} />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Top Spending Customer</p>
            <p className="text-lg font-black text-slate-900 truncate max-w-[150px]">{customer.topSpender.name}</p>
            <p className="text-sm font-bold text-orange-600 mt-1">₹{customer.topSpender.amount.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600">
            <Crown size={24} />
          </div>
        </div>
      </div>
    </div>
  );
}
