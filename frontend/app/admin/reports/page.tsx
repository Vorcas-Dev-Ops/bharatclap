"use client";

import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Calendar, Filter, CheckCircle2 } from 'lucide-react';

export default function ReportsExportsPage() {
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'csv' | 'pdf'>('excel');

  const reportTypes = [
    'Daily Revenue Report',
    'Provider Earnings Report',
    'Settlement Report',
    'GST Report',
    'Refund Report',
    'Booking Report',
    'Provider Performance Report',
    'Provider Attendance Report',
    'Provider Availability Report',
    'Dispatch Performance Report',
    'SLA Report',
    'Lead Revenue Report',
    'Coupon Report',
    'City Performance Report',
    'Category Performance Report',
    'Hourly Demand & Peak Hours Report'
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Reports & Exports Console</h1>
          <p className="text-xs text-gray-500 font-medium">Export 16 Operational & Financial Data Reports into Excel, CSV, or PDF Formats</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedFormat('excel')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              selectedFormat === 'excel' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white/60 text-gray-600'
            }`}
          >
            <FileSpreadsheet size={14} />
            Excel (.xlsx)
          </button>
          <button
            onClick={() => setSelectedFormat('csv')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              selectedFormat === 'csv' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white/60 text-gray-600'
            }`}
          >
            <FileText size={14} />
            CSV
          </button>
          <button
            onClick={() => setSelectedFormat('pdf')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              selectedFormat === 'pdf' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white/60 text-gray-600'
            }`}
          >
            <FileText size={14} />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportTypes.map((report, idx) => (
          <div key={idx} className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition-all space-y-3">
            <h3 className="text-xs font-bold text-gray-900">{report}</h3>
            <p className="text-[10px] text-gray-400">Export filtered historical dataset for accounting, operations, and compliance auditing.</p>
            <button className="w-full py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5">
              <Download size={12} />
              Export {selectedFormat.toUpperCase()}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
