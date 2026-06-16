"use client";

import React from 'react';
import { useReportContext } from '../ReportContext';
import { CalendarCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#e11d48'];

export default function BookingSection() {
  const { data, loading } = useReportContext();

  if (loading || !data) return null;

  const { booking } = data;

  return (
    <div className="space-y-6 mt-12">
      <div className="flex items-center gap-2 mb-4">
        <CalendarCheck className="text-green-600" />
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Booking Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Bookings</p>
          <p className="text-2xl font-black text-slate-900">{booking.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Completed %</p>
          <p className="text-2xl font-black text-green-600">{booking.completedPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Cancelled %</p>
          <p className="text-2xl font-black text-red-500">{booking.cancelledPct.toFixed(1)}%</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pending %</p>
          <p className="text-2xl font-black text-orange-500">{booking.pendingPct.toFixed(1)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Bookings by Day</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={booking.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} width={30} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Line type="monotone" dataKey="bookings" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Category-wise Bookings</p>
          <div className="flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={booking.byCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {booking.byCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {booking.byCategory.slice(0,4).map((entry: any, index: number) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-[10px] font-bold text-slate-600 truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm min-h-[300px] flex flex-col">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Peak Booking Hours</p>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={booking.peakHours}>
                <XAxis dataKey="hour" fontSize={8} axisLine={false} tickLine={false} interval={3} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="bookings" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
