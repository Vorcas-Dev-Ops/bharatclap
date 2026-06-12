"use client";

import React from 'react';
import BIHeader from './BIHeader';
import RevenueSection from './sections/RevenueSection';
import BookingSection from './sections/BookingSection';
import ProviderSection from './sections/ProviderSection';
import CustomerSection from './sections/CustomerSection';
import RefundSection from './sections/RefundSection';
import CommissionSection from './sections/CommissionSection';
import { motion } from 'framer-motion';
import { ReportProvider, useReportContext } from './ReportContext';

const PrintHeader = () => {
  const { filters } = useReportContext();
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const filterText = filters.dateRange === 'Custom' 
    ? `${new Date(filters.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(filters.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : filters.dateRange;

  return (
    <div className="hidden print:block mb-8">
      <h1 className="text-3xl font-black text-gray-900 uppercase tracking-widest mb-4">SERVICE HUB ADMIN REPORT</h1>
      <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-200 py-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Report Generated On:</p>
          <p className="text-lg font-bold text-gray-900">{today}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Filter Applied:</p>
          <p className="text-lg font-bold text-gray-900">{filterText}</p>
        </div>
      </div>
    </div>
  );
};

export default function ReportsOverview() {
  return (
    <ReportProvider>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6 animate-in fade-in duration-700 pb-16 max-w-7xl mx-auto print:max-w-full print:m-0 print:p-0 print:space-y-4"
      >
         <PrintHeader />
         <div className="print:hidden">
           <BIHeader />
         </div>

         <div className="bg-[#f8fafc] -mx-8 px-8 py-8 border-t border-slate-200 print:bg-white print:border-none print:m-0 print:p-0">
           <RevenueSection />
           <BookingSection />
           <ProviderSection />
           <CustomerSection />
           <RefundSection />
           <CommissionSection />
         </div>
      </motion.div>
    </ReportProvider>
  );
}
