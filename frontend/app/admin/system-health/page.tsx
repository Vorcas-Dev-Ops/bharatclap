"use client";

import React, { useState } from 'react';
import { Activity, Server, Cpu, HardDrive, Search, ShieldCheck, RefreshCw, FileCode } from 'lucide-react';

export default function SystemHealthAuditPage() {
  const [correlationId, setCorrelationId] = useState('');

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">System Health & Audit Investigation</h1>
          <p className="text-xs text-gray-500 font-medium">Real-Time Microservices Health, Queue Lag, Redis/Mongo Metrics, and Correlation ID Replay</p>
        </div>
      </div>

      {/* Infrastructure Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">API Gateway</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <span className="text-lg font-black text-gray-900 block">HEALTHY</span>
          <span className="text-[10px] text-emerald-600 font-bold">Port 5000 • 12ms Latency</span>
        </div>

        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MongoDB Cluster</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <span className="text-lg font-black text-gray-900 block">CONNECTED</span>
          <span className="text-[10px] text-emerald-600 font-bold">7 DBs • Primary Online</span>
        </div>

        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Redis Cache & Streams</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <span className="text-lg font-black text-gray-900 block">ACTIVE</span>
          <span className="text-[10px] text-emerald-600 font-bold">0 Queue Lag • PING 1ms</span>
        </div>

        <div className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BullMQ Background Workers</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <span className="text-lg font-black text-gray-900 block">PROCESSING</span>
          <span className="text-[10px] text-emerald-600 font-bold">0 Failed Jobs</span>
        </div>
      </div>

      {/* Audit Investigation Console */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-gray-900 tracking-tight flex items-center gap-2">
          <Search size={16} className="text-blue-600" />
          Audit Investigation Console (Correlation ID Replay)
        </h3>

        <div className="flex gap-2 max-w-xl">
          <input
            type="text"
            value={correlationId}
            onChange={(e) => setCorrelationId(e.target.value)}
            placeholder="Enter Correlation ID (e.g. CORR_1723000000000_abc123)..."
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-mono font-medium text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all">
            Inspect Timeline
          </button>
        </div>

        <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 space-y-2">
          <FileCode size={32} className="mx-auto text-gray-400 opacity-60" />
          <p className="text-xs font-bold text-gray-600">Traceable Request Correlation Log</p>
          <p className="text-[10px] text-gray-400">Enter any x-correlation-id to trace complete API logs across Gateway, Microservices, MongoDB, and Redis.</p>
        </div>
      </div>
    </div>
  );
}
