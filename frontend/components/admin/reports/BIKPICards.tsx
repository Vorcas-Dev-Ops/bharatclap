"use client";

import React from 'react';
import { DollarSign, Users, Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface KPICardProps {
  label: string;
  value: string;
  trend: number;
  icon: any;
  color: string;
  bg: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, trend, icon: Icon, color, bg }) => {
  const isPositive = trend >= 0;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-white/40 backdrop-blur-xl rounded-[2rem] p-6 border border-white/60 shadow-sm transition-all duration-500 overflow-hidden relative group"
    >
       <div className="flex items-start justify-between relative z-10">
          <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center ${color} shadow-lg transition-transform duration-500 group-hover:rotate-6`}>
             <Icon size={24} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Insight</span>
             <div className={`flex items-center gap-0.5 mt-2 px-2 py-0.5 rounded-full text-[9px] font-black ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(trend)}%
             </div>
          </div>
       </div>

       <div className="mt-8 relative z-10">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">{label}</p>
          <p className="text-3xl font-black text-gray-900 tracking-tighter">{value}</p>
       </div>

       {/* Ambient Glow Beam */}
       <div className={`absolute -bottom-6 -right-6 w-16 h-16 rounded-full blur-2xl transition-opacity duration-700 ${color.includes('green') ? 'bg-green-500/10' : color.includes('blue') ? 'bg-blue-500/10' : color.includes('orange') ? 'bg-orange-500/10' : 'bg-purple-500/10'}`} />
    </motion.div>
  );
};

const BIKPICards: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
       <KPICard 
         label="Total Revenue" 
         value="₹1,24,000" 
         trend={12} 
         icon={DollarSign} 
         color="text-green-600" 
         bg="bg-green-50" 
       />
       <KPICard 
         label="Total Bookings" 
         value="856" 
         trend={8} 
         icon={Star} 
         color="text-blue-600" 
         bg="bg-blue-50" 
       />
       <KPICard 
         label="New Customers" 
         value="124" 
         trend={-2.4} 
         icon={Users} 
         color="text-orange-600" 
         bg="bg-orange-50" 
       />
       <KPICard 
         label="Avg Rating" 
         value="4.8" 
         trend={0.5} 
         icon={Star} 
         color="text-purple-600" 
         bg="bg-purple-50" 
       />
    </div>
  );
};

export default BIKPICards;
