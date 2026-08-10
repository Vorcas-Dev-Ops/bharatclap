"use client";

import React, { useState } from 'react';
import { Wallet, IndianRupee, FileText, Download, Clock, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';

export default function ProviderFinancePage() {
  const [activeTab, setActiveTab] = useState<'timeline' | 'wallet' | 'cod' | 'tax'>('timeline');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Provider Finance Center</h1>
          <p className="text-xs text-gray-500 font-medium">Wallet Balance, COD Due, Settlement Timelines, and Downloadable PDF Statements</p>
        </div>

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
          <Download size={14} />
          Download Monthly Statement (PDF)
        </button>
      </div>

      {/* Payout Timeline Banner Component */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Settlement Lifecycle Payout Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          {[
            { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            { label: 'Created', color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { label: 'Hold Period', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            { label: 'Batch', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            { label: 'Transferred', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { label: 'Paid', color: 'bg-green-50 text-green-700 border-green-200' }
          ].map(stage => (
            <div key={stage.label} className={`p-2.5 rounded-xl border ${stage.color} font-bold text-[10px] uppercase tracking-wider`}>
              {stage.label}
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Wallet Balance</span>
          <span className="text-2xl font-black text-gray-900 block">₹0.00</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">COD Due Amount</span>
          <span className="text-2xl font-black text-orange-600 block">₹0.00</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pending Settlement</span>
          <span className="text-2xl font-black text-amber-600 block">₹0.00</span>
        </div>
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid Settlements (MTD)</span>
          <span className="text-2xl font-black text-emerald-600 block">₹0.00</span>
        </div>
      </div>
    </div>
  );
}
