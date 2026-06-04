"use client";

import React from 'react';
import { LucideIcon, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';
import Button from '../common/Button';

interface ReportCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  trend: number;
  onDownload?: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ title, value, icon: Icon, color, bg, trend, onDownload }) => {
  const isPositive = trend >= 0;

  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-7 hover:shadow-xl transition-all duration-500 flex flex-col gap-6 group hover:-translate-y-1">
      <div className="flex items-start justify-between">
        <div className={`p-5 rounded-2xl ${bg} group-hover:scale-110 transition-transform duration-500`}>
          <Icon size={26} className={color} strokeWidth={2.5} />
        </div>
        {onDownload && (
          <Button variant="ghost" size="xs" icon={Download} onClick={onDownload} className="text-gray-400 hover:text-blue-600">Export CSV</Button>
        )}
      </div>

      <div className="flex-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.1em]">{title}</p>
        <div className="flex items-baseline gap-4 mt-2">
          <p className="text-4xl font-black text-gray-900 tracking-tight">{value}</p>
          <span className={`inline-flex items-center gap-0.5 text-xs font-black px-2 py-1 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </span>
        </div>
      </div>
      
      <div className="pt-5 border-t border-gray-50 flex items-center justify-between">
        <p className="text-[11px] text-gray-400 font-semibold italic">Compared to previous period</p>
        <button className="text-xs font-black text-blue-600 hover:text-blue-800 underline decoration-blue-600/30 underline-offset-4 decoration-2">Details</button>
      </div>
    </div>
  );
};

export default ReportCard;
