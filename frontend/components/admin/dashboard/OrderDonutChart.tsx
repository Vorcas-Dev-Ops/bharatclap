"use client";

import React from 'react';
import { motion } from 'framer-motion';

const OrderDonutChart: React.FC = () => {
   const data = [
      { name: 'Completed', value: 65, color: '#2563EB' },
      { name: 'Pending', value: 25, color: '#60A5FA' },
      { name: 'Cancelled', value: 10, color: '#F87171' },
   ];

   let cumulativePercentage = 0;
   const circumference = 2 * Math.PI * 15.9155;

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
                  <span className="text-2xl font-black text-gray-900">8.9k</span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Orders</span>
               </div>
            </div>

            <div className="mt-8 space-y-2 w-full">
               {data.map(item => (
                  <div key={item.name} className="flex items-center justify-between group cursor-pointer px-2 py-1 rounded-lg hover:bg-white/40 transition-colors">
                     <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest group-hover:text-gray-900 transition-colors">{item.name}</span>
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
