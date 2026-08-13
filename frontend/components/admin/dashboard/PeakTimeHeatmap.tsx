"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const PeakTimeHeatmap: React.FC = () => {
   const [hours, setHours] = useState(['9am', '11am', '1pm', '3pm', '5pm', '7pm', '9pm']);
   const [days, setDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
   const [data, setData] = useState<number[][]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const fetchData = async (attempt = 1) => {
         try {
            const res = await authFetch(`${API_BASE}/admin/charts/peak-time-heatmap`);

            if (!res.ok) {
               if ((res.status === 503 || res.status === 504) && attempt < 2) {
                  setTimeout(() => fetchData(attempt + 1), 1000);
                  return;
               }
               console.warn(`[PeakTimeHeatmap] Data unavailable: HTTP ${res.status}`);
               setLoading(false);
               return;
            }

            const json = await res.json();
            if (json.hours) setHours(json.hours);
            if (json.days) setDays(json.days);
            if (json.data) setData(json.data);
            setLoading(false);
         } catch (err: any) {
            console.warn('[PeakTimeHeatmap] Failed to load:', err?.message || err);
            setLoading(false);
         }
      };
      fetchData();
   }, []);

   return (
      <div className="flex flex-col h-full">
         <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Peak Booking Times</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">Demand density analysis</p>
         </div>

         {loading ? (
            <div className="flex-1 flex items-center justify-center">
               <span className="text-sm text-gray-300 animate-pulse font-bold">Loading…</span>
            </div>
         ) : data.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
               <span className="text-sm text-gray-400 font-medium">No booking data available yet</span>
            </div>
         ) : (
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
                        {(data[di] || []).map((val, hi) => (
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
         )}
      </div>
   );
};

export default PeakTimeHeatmap;
