"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const ProviderPerformanceChart: React.FC = () => {
  const [providers, setProviders] = useState<{ name: string; jobs: number; rating: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (attempt = 1) => {
      try {
        const res = await authFetch(`${API_BASE}/admin/charts/provider-performance`);
        
        if (!res.ok) {
          const isTimeout = res.status === 504;
          const maxAttempts = 4;
          
          if (isTimeout && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[ProviderPerformanceChart] Service not ready (attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            setTimeout(() => fetchData(attempt + 1), delay);
            return;
          }
          throw new Error('Network response was not ok');
        }
        
        const json = await res.json();
        if (json.providers) setProviders(json.providers);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch provider performance', err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const maxJobs = Math.max(...providers.map(p => p.jobs), 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="mb-8">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Top Service Providers</h2>
        <p className="text-xs text-gray-400 mt-1 font-medium">Performance leaderboard</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-gray-300 animate-pulse font-bold">Loading…</span>
        </div>
      ) : providers.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-gray-400 font-medium">No data available yet</span>
        </div>
      ) : (
        <div className="flex-1 space-y-6">
          {providers.map((p, i) => (
            <div key={p.name + i} className="flex flex-col gap-2 group cursor-pointer">
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 uppercase tracking-widest group-hover:text-blue-600 transition-colors">
                <span className="truncate max-w-[150px]">{p.name}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-orange-500">
                    <Star size={10} fill="currentColor" />
                    <span>{p.rating}</span>
                  </div>
                  <span className="text-gray-900 font-black">{p.jobs} jobs</span>
                </div>
              </div>
              <div className="h-6 w-full bg-blue-50/20 border border-white/60 rounded-lg overflow-hidden relative shadow-sm group-hover:bg-blue-50/40 transition-colors">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(p.jobs / maxJobs) * 100}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-r-sm shadow-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderPerformanceChart;
