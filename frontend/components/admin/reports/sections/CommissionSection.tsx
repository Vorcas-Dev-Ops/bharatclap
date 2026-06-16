"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { Banknote } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#e11d48'];

export default function CommissionSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) return null;

  const { commission } = data;

  return (
    <div className="space-y-6 mt-12 mb-16">
      <div className="flex items-center gap-2 mb-4">
        <Banknote className="text-emerald-600" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Commission Analytics</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm flex flex-col justify-center items-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Total Commission Earned</p>
          <p className="text-4xl font-black text-emerald-600">₹{commission.total.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Commission by Category</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={commission.byCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                  {commission.byCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {commission.byCategory.slice(0,4).map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-600 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Top Revenue Categories</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={commission.topCategories}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} axisLine={false} tickLine={false} width={80} />
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
