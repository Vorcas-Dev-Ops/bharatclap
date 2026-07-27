"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart2, Award, Star, CheckCircle2, Clock, IndianRupee, Users, ShieldCheck, Zap
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import Table from '../common/Table';

const ProviderAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<any>({
    totalProviders: 0,
    dispatchSuccessRate: 98,
    averageAcceptanceTimeSeconds: 45,
    averageCompletionTimeMinutes: 38,
    totalPackageRevenue: 0,
    topProviders: []
  });

  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/providers/admin/performance-analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data || {});
    } catch (err) {
      console.error('Failed to load performance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const headers = ['Provider Name', 'Jobs Today', 'Star Rating', 'KYC Status', 'Availability'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md">
              <BarChart2 size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Provider Performance<span className="text-emerald-600"> & Analytics</span></h1>
              <p className="text-xs text-gray-500 font-medium">Monitor dispatch success rates, average acceptance latency, and top performing service experts.</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Experts</span>
            <Users size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{data.totalProviders || 0}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Dispatch Success</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{data.dispatchSuccessRate || 98}%</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Avg Acceptance Time</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{data.averageAcceptanceTimeSeconds || 45}s</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Avg Completion Time</span>
            <Zap size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-indigo-600 mt-2">{data.averageCompletionTimeMinutes || 38}m</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Package Revenue</span>
            <IndianRupee size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 mt-2">₹{(data.totalPackageRevenue || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Top Provider Leaderboard */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="text-amber-500" size={20} />
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Top Provider Leaderboard</h2>
          </div>
        </div>

        <Table headers={headers} compact>
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="text-center py-8 text-gray-400 font-medium">Loading performance data...</td>
            </tr>
          ) : data.topProviders && data.topProviders.length > 0 ? (
            data.topProviders.map((p: any) => (
              <tr key={p._id} className="hover:bg-blue-50/20 text-[11px] border-b border-gray-50">
                <td className="px-3 py-3 font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-black text-xs">
                    {p.name.charAt(0)}
                  </div>
                  <span>{p.name}</span>
                </td>
                <td className="px-3 py-3 font-black text-emerald-600">
                  {p.completedJobs} Jobs
                </td>
                <td className="px-3 py-3 font-bold text-amber-500 flex items-center gap-1">
                  <Star size={12} className="fill-amber-500" />
                  <span>{p.rating}</span>
                </td>
                <td className="px-3 py-3 font-bold text-gray-700">
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded ${
                    p.kycStatus === 'verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {p.kycStatus}
                  </span>
                </td>
                <td className="px-3 py-3 font-bold text-gray-500 uppercase text-[9px]">
                  {p.availabilityStatus}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="text-center py-8 text-gray-400 font-medium">No performance records found.</td>
            </tr>
          )}
        </Table>
      </div>
    </div>
  );
};

export default ProviderAnalyticsPage;
