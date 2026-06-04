"use client";

import React from 'react';
import { motion } from 'framer-motion';

const ServicePieChart: React.FC = () => {
   const services = [
      { name: 'AC Repair', value: 35, color: '#2563EB' },
      { name: 'Cleaning', value: 25, color: '#3B82F6' },
      { name: 'Plumbing', value: 20, color: '#60A5FA' },
      { name: 'Electrician', value: 15, color: '#93C5FD' },
      { name: 'Others', value: 5, color: '#BFDBFE' },
   ];

   let cumulativePercentage = 0;

   // Function to calculate SVG dash array for a segment
   const getDashArray = (percentage: number) => {
      const circumference = 2 * Math.PI * 15.9155; // Radius matches diameter 31.831
      return `${(percentage * circumference) / 100} ${circumference}`;
   };

   return (
      <div className="flex flex-col items-center">
         <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 self-start">Service Distribution</h4>
         
         <div className="relative w-40 h-40">
            <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
               {services.map((service, i) => {
                  const dashArray = getDashArray(service.value);
                  const dashOffset = (cumulativePercentage * (2 * Math.PI * 15.9155)) / 100;
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
      </div>
   );
};

export default ServicePieChart;
