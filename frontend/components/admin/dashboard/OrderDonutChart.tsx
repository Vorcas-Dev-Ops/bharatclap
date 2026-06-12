"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const OrderDonutChart: React.FC = () => {
  const [data, setData] = useState([
    { name: 'Completed', value: 0, color: '#2563EB' },
    { name: 'Pending',   value: 0, color: '#60A5FA' },
    { name: 'Cancelled', value: 0, color: '#F87171' },
  ]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
        const res = await fetch(`${API_BASE}/admin/charts/order-status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        if (json.data) setData(json.data);
        if (json.total !== undefined) setTotal(json.total);
      } catch (err) {
        console.error('Failed to fetch order status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  let cumulativePercentage = 0;
  const circumference = 2 * Math.PI * 15.9155;

  const formatTotal = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Order Status</h2>
        <p className="text-xs text-gray-400 mt-1 font-medium">Operational distribution</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-48 h-48">
          <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
            {data.map((item, i) => {
              const dashArray = `${(item.value * circumference) / 100} ${circumference}`;
              const dashOffset = (cumulativePercentage * circumference) / 100;
              cumulativePercentage += item.value;

              return (
                <motion.circle
                  key={item.name}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth="4"
                  strokeDasharray={dashArray}
                  strokeDashoffset={-dashOffset}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: i * 0.2 }}
                  className="cursor-pointer hover:stroke-gray-900 transition-colors"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {loading ? (
              <span className="text-xl font-black text-gray-300 animate-pulse">…</span>
            ) : (
              <span className="text-2xl font-black text-gray-900">{formatTotal(total)}</span>
            )}
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Orders</span>
          </div>
        </div>

        <div className="mt-8 space-y-2 w-full">
          {data.map(item => (
            <div key={item.name} className="flex items-center justify-between group cursor-pointer px-2 py-1 rounded-lg hover:bg-white/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-900 transition-colors">
                  {item.name}
                </span>
              </div>
              <span className="text-xs font-black text-gray-900">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OrderDonutChart;
