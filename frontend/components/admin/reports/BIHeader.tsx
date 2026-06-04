"use client";

import React from 'react';
import { Calendar, MapPin, Layers, Briefcase, Download, Filter } from 'lucide-react';
import Button from '../common/Button';

const BIHeader: React.FC = () => {
   return (
      <div className="flex flex-col gap-8 mb-10">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
               <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                  Report<span className="text-blue-600">s</span>
               </h1>

            </div>

            <div className="flex items-center gap-3">
               <Button
                  variant="outline"
                  size="sm"
                  icon={Download}
                  className="bg-white border-gray-100 text-[10px] uppercase tracking-widest shadow-sm rounded-xl px-5 py-3 font-black"
               >
                  Export Report
               </Button>
               <Button
                  variant="primary"
                  size="sm"
                  icon={Filter}
                  className="bg-blue-600 shadow-lg text-[10px] uppercase tracking-widest rounded-xl px-5 py-3 font-black"
               >
                  Advanced Filters
               </Button>
            </div>
         </div>

         {/* Dynamic Filter Rail */}
         <div className="bg-white/40 backdrop-blur-xl p-3 px-6 rounded-2xl border border-white/60 shadow-sm flex flex-wrap items-center gap-6">
            {/* Date Range */}
            <div className="flex items-center gap-3 pr-6 border-r border-gray-100">
               <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
                  <Calendar size={14} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Date Range</span>
                  <select className="bg-transparent text-[11px] font-black text-gray-900 border-none p-0 focus:ring-0 cursor-pointer">
                     <option>Last 30 Days</option>
                     <option>Last 7 Days</option>
                     <option>Year to Date</option>
                     <option>Custom Range</option>
                  </select>
               </div>
            </div>

            {/* Category */}
            <div className="flex items-center gap-3 pr-6 border-r border-gray-100">
               <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 shadow-inner">
                  <Layers size={14} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Vertical</span>
                  <select className="bg-transparent text-[11px] font-black text-gray-900 border-none p-0 focus:ring-0 cursor-pointer">
                     <option>All Services</option>
                     <option>Cleaning</option>
                     <option>Electrician</option>
                     <option>AC Repair</option>
                  </select>
               </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3 pr-6 border-r border-gray-100">
               <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner">
                  <MapPin size={14} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Location</span>
                  <select className="bg-transparent text-[11px] font-black text-gray-900 border-none p-0 focus:ring-0 cursor-pointer">
                     <option>All India</option>
                     <option>Mumbai</option>
                     <option>Bangalore</option>
                     <option>Delhi</option>
                  </select>
               </div>
            </div>

            {/* Provider */}
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shadow-inner">
                  <Briefcase size={14} />
               </div>
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Provider</span>
                  <select className="bg-transparent text-[11px] font-black text-gray-900 border-none p-0 focus:ring-0 cursor-pointer">
                     <option>All active Pros</option>
                     <option>Verified Only</option>
                     <option>Top Performers</option>
                  </select>
               </div>
            </div>
         </div>
      </div>
   );
};

export default BIHeader;
