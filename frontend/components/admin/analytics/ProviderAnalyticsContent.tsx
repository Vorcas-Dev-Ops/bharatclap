"use client";

import React, { useState, useEffect } from 'react';
import { Activity, Users, Star, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { message } from 'antd';

export default function ProviderAnalyticsContent() {
  const [stats, setStats] = useState({
    activeProviders: 0,
    avgRating: 0,
    topPerformers: 0,
    overallActivity: 'Moderate',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviderStats();
  }, []);

  const fetchProviderStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.data || response.data;
      const providers = Array.isArray(data) ? data : [];

      let activeProviders = 0;
      let totalRating = 0;
      let ratedProviders = 0;
      let topPerformers = 0;

      providers.forEach((provider: any) => {
        if (provider.verificationStatus === 'approved' || provider.status === 'active') {
          activeProviders++;
        }
        
        const rating = provider.rating || 0;
        if (rating > 0) {
          totalRating += rating;
          ratedProviders++;
          if (rating >= 4.5) {
            topPerformers++;
          }
        }
      });

      const avgRating = ratedProviders > 0 ? (totalRating / ratedProviders) : 0;
      
      let overallActivity = 'Low';
      if (activeProviders > 10) overallActivity = 'Moderate';
      if (activeProviders > 50) overallActivity = 'High';
      if (activeProviders > 100) overallActivity = 'Very High';

      setStats({
        activeProviders,
        avgRating,
        topPerformers,
        overallActivity,
      });

    } catch (error) {
      console.error('Error fetching provider stats:', error);
      message.error('Failed to load provider analytics');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Active Providers', value: loading ? '...' : stats.activeProviders.toString(), icon: Users, color: 'blue' },
    { label: 'Avg. Provider Rating', value: loading ? '...' : stats.avgRating.toFixed(1), icon: Star, color: 'amber' },
    { label: 'Top Performers', value: loading ? '...' : stats.topPerformers.toString(), icon: TrendingUp, color: 'emerald' },
    { label: 'Overall Activity', value: loading ? '...' : stats.overallActivity, icon: Activity, color: 'indigo' },
  ];

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
        {statCards.map((stat, i) => (
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
