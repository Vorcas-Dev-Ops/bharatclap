"use client";

import React from 'react';
import { motion } from 'framer-motion';

const PeakTimeHeatmap: React.FC = () => {
   const hours = ['9am', '11am', '1pm', '3pm', '5pm', '7pm', '9pm'];
   const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
   
   // Mock density data (0 to 1)
   const data = [
      [0.2, 0.4, 0.6, 0.3, 0.5, 0.8, 0.4],
      [0.3, 0.5, 0.7, 0.4, 0.6, 0.9, 0.5],
      [0.4, 0.6, 0.8, 0.5, 0.7, 1.0, 0.6],
      [0.3, 0.4, 0.7, 0.4, 0.6, 0.8, 0.4],
      [0.5, 0.7, 0.9, 0.6, 0.8, 0.9, 0.7],
      [0.8, 0.9, 1.0, 0.9, 1.0, 0.7, 0.8],
      [0.7, 0.8, 0.9, 0.8, 0.9, 0.6, 0.7],
   ];

   return (
      <div className="flex flex-col h-full">
         <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Peak Booking Times</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">Demand density analysis</p>
         </div>

         <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex gap-2 mb-2">
               <div className="w-8 shrink-0" />
               {hours.map(h => (
                  <div key={h} className="flex-1 text-[8px] font-black text-gray-400 uppercase text-center">{h}</div>
               ))}
            </div>

            {days.map((day, di) => (
               <div key={day} className="flex gap-2 items-center group">
                  <div className="w-8 shrink-0 text-[9px] font-bold text-gray-500 uppercase tracking-tighter group-hover:text-blue-600 transition-colors">{day}</div>
                  <div className="flex-1 flex gap-1.5 h-6">
                     {data[di].map((val, hi) => (
                        <motion.div
                           key={hi}
                           initial={{ opacity: 0, scale: 0.8 }}
                           animate={{ opacity: 1, scale: 1 }}
                           transition={{ delay: (di * hi) * 0.01 }}
                           className="flex-1 rounded-sm cursor-pointer transition-all hover:scale-110 hover:z-10 relative group/tile"
                           style={{ 
                              backgroundColor: `rgba(37, 99, 235, ${val})`,
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                           }}
                        >
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] font-black px-1.5 py-1 rounded opacity-0 group-hover/tile:opacity-100 pointer-events-none whitespace-nowrap z-50">
                              {Math.round(val * 100)}% Capacity
                           </div>
                        </motion.div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
};

export default PeakTimeHeatmap;
