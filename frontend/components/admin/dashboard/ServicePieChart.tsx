"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const ServicePieChart: React.FC = () => {
  const [services, setServices] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (attempt = 1) => {
      try {
        const res = await authFetch(`${API_BASE}/admin/charts/service-distribution`);
        
        if (!res.ok) {
          const isUnavailable = res.status === 503 || res.status === 502 || res.status === 504;
          const maxAttempts = 4;
          
          if (isUnavailable && attempt < maxAttempts) {
            const delay = Math.pow(2, attempt) * 1000;
            console.warn(`[ServicePieChart] Service not ready (${res.status}, attempt ${attempt}/${maxAttempts}). Retrying in ${delay}ms...`);
            setTimeout(() => fetchData(attempt + 1), delay);
            return;
          }
          console.warn(`[ServicePieChart] Service distribution data unavailable: HTTP ${res.status}`);
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        if (data.services) setServices(data.services);
        setLoading(false);
      } catch (err: any) {
        console.warn('[ServicePieChart] Failed to load service distribution:', err?.message || err);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  let cumulativePercentage = 0;
  const circumference = 2 * Math.PI * 15.9155;

  const getDashArray = (percentage: number) =>
    `${(percentage * circumference) / 100} ${circumference}`;

  return (
    <div className="flex flex-col items-center">
      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 self-start">
        Service Distribution
      </h4>

      {loading ? (
        <div className="w-40 h-40 flex items-center justify-center">
          <span className="text-sm text-gray-300 animate-pulse font-bold">Loading…</span>
        </div>
      ) : (
        <>
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
              {services.map((service, i) => {
                const dashArray = getDashArray(service.value);
                const dashOffset = (cumulativePercentage * circumference) / 100;
                cumulativePercentage += service.value;

                return (
                  <motion.circle
                    key={service.name}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="transparent"
                    stroke={service.color}
                    strokeWidth="5"
                    strokeDasharray={dashArray}
                    strokeDashoffset={-dashOffset}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="transition-all hover:stroke-blue-700 cursor-pointer"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-gray-900">100%</span>
              <span className="text-[8px] font-bold text-gray-400 uppercase">Bookings</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-8 w-full">
            {services.map((service) => (
              <div key={service.name} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: service.color }} />
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-gray-600 truncate">{service.name}</span>
                  <span className="text-[8px] font-black text-gray-900">{service.value}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ServicePieChart;
