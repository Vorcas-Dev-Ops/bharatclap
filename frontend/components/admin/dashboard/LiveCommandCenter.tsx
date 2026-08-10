"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Briefcase, Clock, CheckCircle2, AlertTriangle, ShieldAlert,
  TrendingUp, RefreshCw, Activity, PhoneCall, ArrowUpRight
} from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

export default function LiveCommandCenter() {
  const [kpis, setKpis] = useState<any>(null);
  const [healthMetrics, setHealthMetrics] = useState<any>(null);
  const [liveQueue, setLiveQueue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchLiveStats = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';
      
      const [kpiRes, queueRes] = await Promise.all([
        authFetch(`${apiUrl}/admin/dashboard/live-kpis`),
        authFetch(`${apiUrl}/admin/dashboard/live-queue`)
      ]);

      if (kpiRes && kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpis(kData.data?.kpis);
        setHealthMetrics(kData.data?.healthMetrics);
      }

      if (queueRes && queueRes.ok) {
        const qData = await queueRes.json();
        setLiveQueue(qData.data?.liveQueue);
      }
    } catch (err) {
      console.error('Failed to fetch live stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStats();
    const timer = setInterval(fetchLiveStats, 15000); // Live poll every 15s
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Emergency & Critical Operational Alerts */}
      <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-xl rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-500/20 text-red-600 rounded-xl">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">Live System Alerts</h4>
            <p className="text-xs text-red-700 font-medium">0 Emergency Bookings • 0 SLA Breaches • Payment Gateway Active</p>
          </div>
        </div>
        <button
          onClick={fetchLiveStats}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-xs font-bold text-gray-700 rounded-xl border shadow-sm transition-all"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* 2. 10 Operational Health Metrics Bar */}
      {healthMetrics && (
        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3 text-center">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg ETA</span>
            <span className="text-sm font-black text-gray-900">{healthMetrics.averageEtaMinutes} mins</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Acceptance</span>
            <span className="text-sm font-black text-emerald-600">{healthMetrics.acceptanceRate}%</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Completion</span>
            <span className="text-sm font-black text-emerald-600">{healthMetrics.completionRate}%</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Cancelled</span>
            <span className="text-sm font-black text-red-500">{healthMetrics.cancellationPercent}%</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rating</span>
            <span className="text-sm font-black text-amber-500">★ {healthMetrics.averageRating}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Response</span>
            <span className="text-sm font-black text-gray-900">{healthMetrics.averageResponseTimeSeconds}s</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Dispatch</span>
            <span className="text-sm font-black text-blue-600">{healthMetrics.dispatchSuccessRate}%</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Utilization</span>
            <span className="text-sm font-black text-purple-600">{healthMetrics.providerUtilizationPercent}%</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Settlement</span>
            <span className="text-sm font-black text-gray-900">{healthMetrics.averageSettlementTimeDays}d</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Refund</span>
            <span className="text-sm font-black text-gray-900">{healthMetrics.averageRefundTimeMinutes}m</span>
          </div>
        </div>
      )}

      {/* 3. Live Booking Queue Stepper */}
      {liveQueue && (
        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Activity size={16} className="text-blue-600" />
              Live Booking Queue Stepper (Decoupled Operational Lifecycle)
            </h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">Live Synced</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {[
              { label: 'Pending', count: liveQueue.pending, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
              { label: 'Searching', count: liveQueue.searching_provider, color: 'bg-blue-50 text-blue-700 border-blue-200' },
              { label: 'Assigned', count: liveQueue.assigned, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
              { label: 'Accepted', count: liveQueue.accepted, color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
              { label: 'Travelling', count: liveQueue.travelling, color: 'bg-purple-50 text-purple-700 border-purple-200' },
              { label: 'Arrived', count: liveQueue.arrived, color: 'bg-amber-50 text-amber-700 border-amber-200' },
              { label: 'Running', count: liveQueue.service_running, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              { label: 'Pay Pending', count: liveQueue.payment_pending, color: 'bg-orange-50 text-orange-700 border-orange-200' },
              { label: 'Completed', count: liveQueue.completed, color: 'bg-green-50 text-green-700 border-green-200' },
              { label: 'Cancelled', count: liveQueue.cancelled, color: 'bg-red-50 text-red-700 border-red-200' }
            ].map(item => (
              <div key={item.label} className={`p-3 rounded-xl border ${item.color} text-center space-y-1`}>
                <span className="text-[9px] font-black uppercase tracking-wider block opacity-70">{item.label}</span>
                <span className="text-lg font-black">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
