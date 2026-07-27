"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const BookingChart: React.FC = () => {
  const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [currentWeek, setCurrentWeek] = useState<number[]>(Array(7).fill(0));
  const [lastWeek, setLastWeek] = useState<number[]>(Array(7).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (attempt = 1) => {
      try {
        const res = await authFetch(`${API_BASE}/admin/charts/booking-chart`);
        
        if (!res.ok) {
          const isUnavailable = res.status === 503 || res.status === 502 || res.status === 504;
          const maxAttempts = 4;
          
          if (isUnavailable && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[BookingChart] Service not ready (${res.status}, attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            setTimeout(() => fetchData(attempt + 1), delay);
            return;
          }
          console.warn(`[BookingChart] Booking chart data unavailable: HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        if (data.days) setDays(data.days);
        if (data.currentWeek) setCurrentWeek(data.currentWeek);
        if (data.previousWeek) setLastWeek(data.previousWeek);
        setLoading(false);
      } catch (err: any) {
        console.warn('[BookingChart] Failed to load booking chart data:', err?.message || err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const max = Math.max(...currentWeek, ...lastWeek, 1);

  return (
    <div className="flex flex-col h-[350px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Booking Trend</h2>
          <p className="text-xs text-gray-400 mt-1 font-medium">Daily volume comparison</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-blue-100 rounded-full" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Previous</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-gray-300 animate-pulse font-bold">Loading chart…</span>
        </div>
      ) : (
        <div className="flex-1 flex items-end gap-3 sm:gap-6 relative">
          {/* Background Grid Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-full h-[1px] bg-gray-900" />
            ))}
          </div>

          {days.map((day, i) => {
            const currentHeight = Math.round((currentWeek[i] / max) * 100);
            const lastHeight = Math.round((lastWeek[i] / max) * 100);

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full relative z-10">
                <div className="flex-1 flex items-end gap-1.5 w-full relative pt-8">
                  {/* Previous Week Bar */}
                  <div className="flex-1 h-full relative group/prev">
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-400 opacity-0 group-hover/prev:opacity-100 transition-opacity">
                      {lastWeek[i]}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${lastHeight}%` }}
                      transition={{ duration: 1 }}
                      className="absolute bottom-0 w-full bg-blue-100 rounded-sm hover:bg-blue-200 transition-colors"
                    />
                  </div>

                  {/* Current Week Bar */}
                  <div className="flex-1 h-full relative group/curr">
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-black text-blue-600 opacity-0 group-hover/curr:opacity-100 transition-opacity">
                      {currentWeek[i]}
                    </span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${currentHeight}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="absolute bottom-0 w-full bg-blue-600 rounded-sm shadow-sm hover:scale-x-110 transition-transform"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{day}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingChart;
