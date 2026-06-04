"use client";
import React from 'react';
import { Users, Briefcase, CalendarCheck, DollarSign } from 'lucide-react';

export default function DashboardOverview() {
  const stats = [
    { title: 'Users', value: '1,245', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Providers', value: '320', icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Bookings Today', value: '86', icon: CalendarCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Revenue', value: '₹12,540', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome to the ServiceAdmin portal.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.02)] flex items-center gap-4 transition-all hover:shadow-md">
               <div className={`p-4 rounded-xl ${stat.bg}`}>
                  <Icon size={24} className={stat.color} strokeWidth={2} />
               </div>
               <div>
                  <h3 className="text-gray-500 text-sm font-medium">{stat.title}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
               </div>
            </div>
          );
        })}
      </div>

      {/* Charts / Lower Section Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[350px] flex flex-col justify-between">
            <div>
               <h2 className="text-lg font-bold text-gray-800">Booking Trends</h2>
               <p className="text-sm text-gray-500">Last 7 days overview</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <p className="text-gray-400">Chart will be rendered here</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm min-h-[350px] flex flex-col justify-between">
            <div>
               <h2 className="text-lg font-bold text-gray-800">Revenue Trends</h2>
               <p className="text-sm text-gray-500">Monthly revenue analytics</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
               <p className="text-gray-400">Chart will be rendered here</p>
            </div>
         </div>
      </div>
    </div>
  );
}
