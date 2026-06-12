"use client";

import React, { useState } from 'react';
import { UserMinus, CheckCircle } from 'lucide-react';

export default function WaiversTab() {
  const [provider, setProvider] = useState('');
  const [reason, setReason] = useState('');
  const [waiverType, setWaiverType] = useState('full');
  const [amount, setAmount] = useState(895);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 max-w-2xl">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
            <UserMinus size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Grant Payment Waiver</h2>
            <p className="text-xs text-slate-500 font-medium">Waive starter kit fees for specific providers</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Provider</label>
            <input 
              type="text" 
              placeholder="Search provider by name or ID..." 
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${waiverType === 'full' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-slate-900">Full Waiver</span>
                <input type="radio" name="waiverType" checked={waiverType === 'full'} onChange={() => setWaiverType('full')} className="w-4 h-4 text-purple-600 focus:ring-purple-500" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Provider pays ₹0. Platform absorbs full cost.</p>
            </label>
            <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${waiverType === 'partial' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-slate-900">Partial Waiver</span>
                <input type="radio" name="waiverType" checked={waiverType === 'partial'} onChange={() => setWaiverType('partial')} className="w-4 h-4 text-purple-600 focus:ring-purple-500" />
              </div>
              <p className="text-xs text-slate-500 font-medium">Specify a custom discount amount.</p>
            </label>
          </div>

          {waiverType === 'partial' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Waiver Amount (₹)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Reason for Waiver</label>
            <textarea 
              rows={3} 
              placeholder="e.g. Promotional Onboarding, Top Earner Reward"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-600">
              Provider will pay: <span className="font-black text-slate-900 text-lg ml-1">₹{waiverType === 'full' ? 0 : Math.max(0, 895 - amount)}</span>
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20">
              <CheckCircle size={18} /> Grant Waiver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
