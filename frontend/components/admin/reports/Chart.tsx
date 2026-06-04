"use client";

import React from 'react';

interface ChartProps {
  title: string;
  subtitle?: string;
  type?: 'bar' | 'line';
  data: number[];
  labels: string[];
}

const Chart: React.FC<ChartProps> = ({ title, subtitle, data, labels, type = 'bar' }) => {
  const max = Math.max(...data);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 flex flex-col min-h-[400px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1 font-medium">{subtitle}</p>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex gap-4 items-end mt-4">
        {data.map((val, i) => {
          const heightPct = Math.round((val / max) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full">
               <div className="flex-1 w-full bg-gray-50 rounded-xl relative overflow-hidden group-hover:bg-blue-50 transition-colors">
                 <div
                   className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-xl transition-all duration-700"
                   style={{ height: `${heightPct}%` }}
                 />
                 {/* Tooltip on hover */}
                 <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white rounded text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-lg">
                    {val}
                 </div>
               </div>
               <span className="text-[10px] sm:text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">{labels[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Chart;
