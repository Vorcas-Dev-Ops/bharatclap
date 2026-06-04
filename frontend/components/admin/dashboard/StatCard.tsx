"use client";

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color?: string;
  bg?: string;
  trend?: number; 
  trendLabel?: string;
  description?: string;
  index: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, bg, trend, trendLabel, description, index }) => {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
      whileHover={{ y: -5 }}
      className="group relative"
    >
      {/* Glass Theme Card - Compact for 6-column row */}
      <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl border border-white/50 p-4 rounded-xl shadow-sm hover:shadow-xl hover:bg-white/60 transition-all duration-300 h-full flex flex-col">
        {/* Subtle Theme Background Element */}
        <div className="absolute -top-4 -right-4 w-16 h-16 bg-blue-50/20 rounded-full blur-2xl group-hover:bg-blue-100/20 transition-colors duration-500" />
        
        <div className="flex items-start justify-between relative z-10 mb-4">
          <div className="relative">
             {/* Logo/Icon Container - Thinner padding */}
             <div className="p-2 rounded-lg bg-white/60 text-blue-600 border border-white group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm">
               <Icon size={16} strokeWidth={2.5} />
             </div>
          </div>
          
          {trend !== undefined && (
            <div className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md ${
              isPositive ? 'bg-green-100/50 text-green-700' : 'bg-red-100/50 text-red-700'
            } border transition-colors ${isPositive ? 'border-green-200/50' : 'border-red-200/50'} backdrop-blur-md`}>
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="mt-auto relative z-10">
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1 truncate">{title}</p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none whitespace-nowrap">
              {value}
            </h2>
            {trendLabel && (
              <span className="text-[9px] font-bold text-gray-400 lowercase tracking-widest truncate">{trendLabel}</span>
            )}
          </div>
          
          {description && (
             <p className="text-[9px] text-gray-400 font-medium mt-3 flex items-center gap-1.5 truncate">
               <span className={`w-1 h-1 rounded-full ${isPositive ? 'bg-green-400' : 'bg-red-400'}`} />
               {description}
             </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
