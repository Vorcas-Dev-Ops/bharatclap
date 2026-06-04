"use client";

import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, DollarSign, Calendar, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { message } from 'antd';

export default function RevenueAnalyticsContent() {
  const [data, setData] = useState({
    totalRevenue: 0,
    platformFee: 0,
    growth: "0.0",
    transactionsThisMonth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/payments/analytics/revenue`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) {
        setData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      message.error('Failed to load live revenue analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Analytics</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Detailed breakdown of platform earnings and transactions.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: formatCurrency(data.totalRevenue), icon: DollarSign, color: 'emerald' },
          { label: 'Platform Fee (Commission)', value: formatCurrency(data.platformFee), icon: PieChart, color: 'blue' },
          { label: 'Growth', value: `+${data.growth}%`, icon: TrendingUp, color: 'emerald' },
          { label: 'Transactions This Month', value: data.transactionsThisMonth.toString(), icon: Calendar, color: 'indigo' },
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
        <PieChart className="w-16 h-16 mb-4 text-slate-200" />
        <p className="text-lg font-bold text-slate-600">Revenue Charts Coming Soon</p>
        <p className="text-sm font-medium">Detailed visualizations are being prepared.</p>
      </div>
    </div>
  );
}
