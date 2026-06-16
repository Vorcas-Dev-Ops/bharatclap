"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#e11d48'];

export default function RefundSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) return null;

  const { refund } = data;

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center gap-2 mb-4">
        <RotateCcw className="text-red-500" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Refund Analytics</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Refund Rate</p>
            <p className="text-4xl font-black text-red-500">{refund.rate}%</p>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col justify-center">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Refund Amount</p>
            <p className="text-3xl font-black text-slate-900">₹{refund.totalAmount.toLocaleString()}</p>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Refund Amount Trend</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={refund.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={40} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Most Refunded Categories</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={refund.categories} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                  {refund.categories.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => `₹${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[250px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Most Common Reasons</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={refund.reasons}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={9} axisLine={false} tickLine={false} width={100} />
                <Tooltip formatter={(value: any) => `${value}%`} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
