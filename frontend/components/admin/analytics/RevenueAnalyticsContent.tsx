"use client";

import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts';
import Link from 'next/link';

// Mock Data matching the image roughly
const revenueByDayData = [
  { name: '01 May', revenue: 20000 },
  { name: '08 May', revenue: 50000 },
  { name: '15 May', revenue: 25000 },
  { name: '22 May', revenue: 75000 },
  { name: '31 May', revenue: 55000 },
];

const revenueByMonthData = [
  { name: 'Jan', revenue: 500000 },
  { name: 'Feb', revenue: 800000 },
  { name: 'Mar', revenue: 600000 },
  { name: 'Apr', revenue: 1200000 },
  { name: 'May', revenue: 900000 },
  { name: 'Jun', revenue: 400000 },
];

const revenueByCategoryData = [
  { name: 'AC Repair', value: 35 },
  { name: 'Plumbing', value: 25 },
  { name: 'Electrical', value: 20 },
  { name: 'Appliance Repair', value: 10 },
  { name: 'Others', value: 10 },
];
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

export default function RevenueAnalyticsContent() {
  const [activeTab, setActiveTab] = useState('Payment Analytics');

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-[#FAFAFA] min-h-screen space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-800 mb-1">Revenue Analytics</h1>
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/admin/dashboard" className="hover:text-blue-600">Finance</Link>
          <ChevronRight size={14} className="mx-1" />
          <span className="text-slate-700 font-medium">Revenue Analytics</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {['Payment Analytics', 'Payout Analytics', 'Refund Analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-bold transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        
        {/* Revenue by Day (Line Chart) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6">Revenue by Day</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <RechartsTooltip formatter={(value: any) => [value !== undefined ? `₹${Number(value).toLocaleString()}` : '', 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Month (Bar Chart) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6">Revenue by Month</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByMonthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <RechartsTooltip formatter={(value: any) => [value !== undefined ? `₹${Number(value).toLocaleString()}` : '', 'Revenue']} cursor={{fill: '#f8fafc'}} />
                <Bar dataKey="revenue" fill="#bfdbfe" radius={[4, 4, 0, 0]} activeBar={{ fill: '#3b82f6' }} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Service Category (Donut Chart) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 mb-6">Revenue by Service Category</h3>
          <div className="h-[300px] relative flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={revenueByCategoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {revenueByCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: any) => value !== undefined ? `${value}%` : ''} />
                <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
            
            {/* Center Label */}
            <div className="absolute text-center" style={{ left: '35%' }}>
              <p className="text-lg font-black text-slate-800 leading-none">₹ 12,45,230</p>
              <p className="text-[10px] font-bold text-slate-500">Total</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
