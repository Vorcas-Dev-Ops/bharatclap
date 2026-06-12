"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { DollarSign, Wallet, Activity, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#e11d48'];

export default function RevenueSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) {
    return <div className="animate-pulse bg-white/40 h-96 rounded-3xl" />;
  }

  const { revenue } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="text-blue-600" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Revenue Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-slate-900">₹{revenue.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Commission Earned</p>
          <p className="text-2xl font-black text-purple-600">₹{revenue.commission.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Provider Earnings</p>
          <p className="text-2xl font-black text-blue-600">₹{revenue.providerEarnings.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Net Platform Profit</p>
          <p className="text-2xl font-black text-orange-600">₹{revenue.netProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Revenue Trend</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v/1000}k`} width={40} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Revenue by Category</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={revenue.byCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {revenue.byCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {revenue.byCategory.slice(0,4).map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-600 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Revenue by City</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={revenue.byCity}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
