"use client";

import React from 'react';
import { Activity, Users, Star, TrendingUp } from 'lucide-react';

export default function ProviderAnalyticsContent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Provider Analytics</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Insights into provider performance and activity.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Providers', value: '142', icon: Users, color: 'blue' },
          { label: 'Avg. Provider Rating', value: '4.7', icon: Star, color: 'amber' },
          { label: 'Top Performers', value: '15', icon: TrendingUp, color: 'emerald' },
          { label: 'Overall Activity', value: 'High', icon: Activity, color: 'indigo' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{stat.label}</p>
              <stat.icon size={14} className={`text-${stat.color}-500`} />
            </div>
            <h3 className="text-xl font-black text-slate-900">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Placeholder for Charts */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-400">
        <Activity className="w-16 h-16 mb-4 text-slate-200" />
        <p className="text-lg font-bold text-slate-600">Provider Analytics Coming Soon</p>
        <p className="text-sm font-medium">Detailed visualizations are being prepared.</p>
      </div>
    </div>
  );
}
