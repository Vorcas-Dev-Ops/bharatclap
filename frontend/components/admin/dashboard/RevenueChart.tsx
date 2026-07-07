"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const RevenueChart: React.FC = () => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [months, setMonths] = useState<string[]>(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  const [currentData, setCurrentData] = useState<number[]>(Array(12).fill(0));
  const [lastData, setLastData] = useState<number[]>(Array(12).fill(0));
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [growthPct, setGrowthPct] = useState('0.0');
  const [loading, setLoading] = useState(true);

  const [grouping, setGrouping] = useState<'daily' | 'monthly' | 'quarterly' | 'yearly'>('monthly');

  useEffect(() => {
    const fetchData = async (attempt = 1) => {
      try {
        setLoading(true);
        const res = await authFetch(`${API_BASE}/admin/charts/revenue-chart?grouping=${grouping}`);
        
        if (!res.ok) {
          const isTimeout = res.status === 504;
          const maxAttempts = 4;
          
          if (isTimeout && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[RevenueChart] Service not ready (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            setTimeout(() => fetchData(attempt + 1), delay);
            return;
          }
          const errorText = await res.text().catch(() => 'No text');
          throw new Error(`Network response was not ok: ${res.status} ${res.statusText} - ${errorText}`);
        }
        
        const data = await res.json();
        if (data.months) setMonths(data.months);
        if (data.currentData) setCurrentData(data.currentData);
        if (data.previousData) setLastData(data.previousData);
        if (data.totalRevenue !== undefined) setTotalRevenue(data.totalRevenue);
        if (data.growthPct !== undefined) setGrowthPct(data.growthPct);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch revenue chart data', err);
        setLoading(false);
      }
    };
    fetchData();
  }, [grouping]);

  // Geometry Constants (Internal SVG Coordinate System: 1000x300)
  const W = 1000;
  const H = 300;
  const MAX_VAL = Math.max(...currentData, ...lastData, 10) * 1.15;

  const currentPoints = currentData.map((val, i) => ({
    x: (i / (currentData.length - 1)) * W,
    y: H - (val / MAX_VAL) * H
  }));

  const lastPoints = lastData.map((val, i) => ({
    x: (i / (lastData.length - 1)) * W,
    y: H - (val / MAX_VAL) * H
  }));

  const createPath = (points: { x: number, y: number }[]) => {
    return points.reduce((acc, point, i, a) => {
      if (i === 0) return `M ${point.x},${point.y}`;
      const p0 = a[i - 1];
      const cx = p0.x + (point.x - p0.x) * 0.35;
      return `${acc} C ${cx},${p0.y} ${cx},${point.y} ${point.x},${point.y}`;
    }, '');
  };

  const currentPath = createPath(currentPoints);
  const lastPath = createPath(lastPoints);
  const fillPath = `${currentPath} V ${H} H 0 Z`;

  const formatRevenue = (val: number) => {
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}L`;
    return `₹${val}k`;
  };

  const growth = parseFloat(growthPct);

  return (
    <div className="flex flex-col h-[350px]">
      {/* Header Metric Bar */}
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Platform Revenue</h2>
            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-full border ${growth >= 0 ? 'bg-green-100 text-green-600 border-green-200' : 'bg-red-100 text-red-600 border-red-200'}`}>
              {growth >= 0 ? '+' : ''}{growthPct}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            {loading ? (
              <span className="text-3xl font-black text-gray-300 tracking-tighter animate-pulse">Loading…</span>
            ) : (
              <span className="text-3xl font-black text-gray-900 tracking-tighter">{formatRevenue(totalRevenue)}</span>
            )}
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gross Yield</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-gray-100/50 p-1 rounded-xl">
            {(['daily', 'monthly', 'quarterly', 'yearly'] as const).map(period => (
              <button
                key={period}
                onClick={() => setGrouping(period)}
                className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  grouping === period 
                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200/50' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {period === 'daily' ? 'Day' : period === 'monthly' ? 'Month' : period === 'quarterly' ? 'Quarter' : 'Year'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 hidden sm:flex">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Current</span>
          </div>
          <div className="flex items-center gap-2 opacity-30 hidden sm:flex">
            <span className="w-2.5 h-2.5 bg-slate-400 rounded-full" />
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Previous</span>
          </div>
        </div>
      </div>

      {/* Main Chart Body */}
      <div className="flex-1 flex gap-4 min-h-0 relative">
        {/* Fixed Left Y-Axis */}
        <div className="flex flex-col justify-between text-[11px] font-black text-gray-300 py-1 shrink-0">
          <span>₹{Math.round(MAX_VAL)}k</span>
          <span>₹{Math.round(MAX_VAL * 0.75)}k</span>
          <span>₹{Math.round(MAX_VAL * 0.5)}k</span>
          <span>₹{Math.round(MAX_VAL * 0.25)}k</span>
          <span>₹0</span>
        </div>

        {/* Chart Content Area */}
        <div className="flex-1 relative">
          {/* Background Horizontal Guide Lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none opacity-[0.05]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-full h-[1px] bg-gray-900" />
            ))}
          </div>

          {/* SVG Content */}
          <div className="absolute inset-0 py-1">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Previous Period Line */}
              <motion.path
                d={lastPath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5 }}
              />

              {/* Area Gradient Fill */}
              <motion.path
                d={fillPath}
                fill="url(#area-gradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              />

              {/* Primary Growth Path */}
              <motion.path
                d={currentPath}
                fill="none"
                stroke="#2563EB"
                strokeWidth="4"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2, ease: "easeOut" }}
              />

              {/* Silent Interaction Hubs */}
              {currentPoints.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - 50}
                  y={0}
                  width={W / (currentData.length - 1)}
                  height={H}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </svg>

            {/* HTML Overlay Tooltip */}
            <AnimatePresence>
              {hoveredIndex !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute z-50 pointer-events-none transform -translate-x-1/2"
                  style={{
                    left: `${(hoveredIndex / (currentData.length - 1)) * 100}%`,
                    top: `${(currentPoints[hoveredIndex].y / H) * 100}%`,
                    marginTop: '-45px'
                  }}
                >
                  <div className="bg-[#0F172A] text-white text-[10px] font-black rounded-lg px-3 py-1.5 shadow-2xl border border-white/20 whitespace-nowrap">
                    ₹{currentData[hoveredIndex]}k
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0F172A] rotate-45" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Synchronized X-Axis Labels */}
      <div className="flex px-[42px] mt-6 justify-between shrink-0">
        {months.map((m, i) => (
          <span key={i} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{m}</span>
        ))}
      </div>
    </div>
  );
};

export default RevenueChart;
