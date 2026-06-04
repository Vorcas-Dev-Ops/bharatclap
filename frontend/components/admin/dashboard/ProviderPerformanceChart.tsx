"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const ProviderPerformanceChart: React.FC = () => {
   const providers = [
      { name: 'Arjun Verma', jobs: 124, rating: 4.8 },
      { name: 'Sneha Kapur', jobs: 98, rating: 4.9 },
      { name: 'Ritesh Kumar', jobs: 86, rating: 4.6 },
      { name: 'Priya Sharma', jobs: 74, rating: 4.7 },
      { name: 'Vikki Singh', jobs: 62, rating: 4.5 },
   ];

   const maxJobs = Math.max(...providers.map(p => p.jobs));

   return (
      <div className="flex flex-col h-full overflow-hidden">
         <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Top Service Providers</h2>
            <p className="text-xs text-gray-400 mt-1 font-medium">Performance leaderboard</p>
         </div>

         <div className="flex-1 space-y-6">
            {providers.map((p, i) => (
               <div key={p.name} className="flex flex-col gap-2 group cursor-pointer">
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
      </div>
   );
};

export default ProviderPerformanceChart;
