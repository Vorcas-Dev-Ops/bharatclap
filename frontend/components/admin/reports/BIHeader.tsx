"use client";

import React, { useState } from 'react';
import { Calendar, Download, ChevronDown, FileText, FileSpreadsheet, X } from 'lucide-react';
import { useReportContext } from './ReportContext';
import { motion, AnimatePresence } from 'framer-motion';

const BIHeader: React.FC = () => {
   const { filters, setFilters, exportReport } = useReportContext();
   const [isDateMenuOpen, setIsDateMenuOpen] = useState(false);
   const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
   const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

   const [customStart, setCustomStart] = useState('');
   const [customEnd, setCustomEnd] = useState('');

   const handlePredefinedFilter = (range: string) => {
      setFilters({ dateRange: range, startDate: '', endDate: '' });
      setIsDateMenuOpen(false);
   };

   const applyCustomFilter = () => {
      if (customStart && customEnd) {
         setFilters({ dateRange: 'Custom', startDate: customStart, endDate: customEnd });
         setIsCustomModalOpen(false);
         setIsDateMenuOpen(false);
      }
   };

   const todayString = new Date().toISOString().split('T')[0];

   return (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
         <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
               Reports
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
               Comprehensive business insights and analytics overview
            </p>
         </div>

         <div className="flex items-center gap-3">
            {/* Date Filter Dropdown */}
            <div className="relative">
               <button 
                  onClick={() => setIsDateMenuOpen(!isDateMenuOpen)}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold shadow-sm rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors"
               >
                  <Calendar size={16} className="text-gray-400" />
                  {filters.dateRange === 'Custom' 
                     ? `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`
                     : filters.dateRange}
                  <ChevronDown size={14} className="text-gray-400 ml-1" />
               </button>

               <AnimatePresence>
                  {isDateMenuOpen && (
                     <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDateMenuOpen(false)} />
                        <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: 10 }}
                           className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                        >
                           {['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Month', 'Previous Month'].map((range) => (
                              <button
                                 key={range}
                                 onClick={() => handlePredefinedFilter(range)}
                                 className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              >
                                 {range}
                              </button>
                           ))}
                           <div className="h-px bg-gray-100 my-1" />
                           <button
                              onClick={() => {
                                 setIsCustomModalOpen(true);
                                 setIsDateMenuOpen(false);
                              }}
                              className="w-full text-left px-4 py-2 text-sm font-bold text-gray-900 hover:bg-gray-50 transition-colors"
                           >
                              Custom Date Range
                           </button>
                        </motion.div>
                     </>
                  )}
               </AnimatePresence>
            </div>

            {/* Export Dropdown */}
            <div className="relative">
               <button 
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-bold shadow-sm rounded-xl px-4 py-2.5 hover:bg-gray-50 transition-colors"
               >
                  <Download size={16} className="text-gray-400" />
                  Export Report
                  <ChevronDown size={14} className="text-gray-400 ml-1" />
               </button>

               <AnimatePresence>
                  {isExportMenuOpen && (
                     <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                        <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, y: 10 }}
                           className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                        >
                           <button
                              onClick={() => {
                                 exportReport('pdf');
                                 setIsExportMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                           >
                              <FileText size={16} className="text-red-500" />
                              Download as PDF
                           </button>
                           <button
                              onClick={() => {
                                 exportReport('csv');
                                 setIsExportMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                           >
                              <FileSpreadsheet size={16} className="text-green-500" />
                              Download as CSV
                           </button>
                        </motion.div>
                     </>
                  )}
               </AnimatePresence>
            </div>
         </div>

         {/* Custom Date Modal */}
         <AnimatePresence>
            {isCustomModalOpen && (
               <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                  >
                     <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Select Date Range</h3>
                        <button onClick={() => setIsCustomModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                           <X size={20} />
                        </button>
                     </div>
                     <div className="p-6 space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">From Date</label>
                           <input 
                              type="date" 
                              max={todayString}
                              value={customStart}
                              onChange={(e) => setCustomStart(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">To Date</label>
                           <input 
                              type="date" 
                              max={todayString}
                              min={customStart}
                              value={customEnd}
                              onChange={(e) => setCustomEnd(e.target.value)}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                           />
                        </div>
                     </div>
                     <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button 
                           onClick={() => setIsCustomModalOpen(false)}
                           className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-gray-900"
                        >
                           Cancel
                        </button>
                        <button 
                           onClick={applyCustomFilter}
                           disabled={!customStart || !customEnd}
                           className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-600/20"
                        >
                           Apply Filter
                        </button>
                     </div>
                  </motion.div>
               </div>
            )}
         </AnimatePresence>
      </div>
   );
};

export default BIHeader;
