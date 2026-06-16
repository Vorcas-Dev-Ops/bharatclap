"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { Briefcase, Trophy, Star, UserX, UserCheck } from 'lucide-react';

export default function ProviderSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) return null;

  const { provider } = data;

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="text-purple-600" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Provider Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
            <Trophy size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Top Earning Provider</p>
            <p className="text-lg font-black text-slate-900 truncate max-w-[150px]">{provider.topEarning.name}</p>
            <p className="text-sm font-bold text-green-600 mt-1">₹{provider.topEarning.amount.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Most Booked Provider</p>
            <p className="text-lg font-black text-slate-900 truncate max-w-[150px]">{provider.mostBooked.name}</p>
            <p className="text-sm font-bold text-blue-600 mt-1">{provider.mostBooked.bookings} bookings</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
            <Star size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Highest Rated Provider</p>
            <p className="text-lg font-black text-slate-900 truncate max-w-[150px]">{provider.highestRated.name}</p>
            <p className="text-sm font-bold text-orange-600 mt-1">{provider.highestRated.rating} / 5</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Inactive Providers</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{provider.inactiveCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
