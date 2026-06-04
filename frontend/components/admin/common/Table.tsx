"use client";

import React from 'react';

interface TableProps {
  headers: React.ReactNode[];
  children: React.ReactNode;
  pagination?: {
    total?: number;
    showingFrom?: number;
    showingTo?: number;
    onPrev?: () => void;
    onNext?: () => void;
  };
  isLoading?: boolean;
  className?: string;
}

const Table: React.FC<TableProps> = ({ 
  headers, 
  children, 
  pagination, 
  isLoading = false,
  className = ""
}) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
              {headers.map((header, index) => (
                <th 
                  key={index} 
                  className={`px-6 py-4 font-semibold ${index === 0 ? 'rounded-tl-xl' : ''} ${index === headers.length - 1 ? 'rounded-tr-xl text-center' : ''}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-20 text-center">
                   <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                      <span className="text-gray-400 font-medium tracking-tight">Loading data...</span>
                   </div>
                </td>
              </tr>
            ) : children}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{pagination.showingFrom}</span> to <span className="font-semibold text-gray-700">{pagination.showingTo}</span> of <span className="font-semibold text-gray-700">{pagination.total}</span> entries
          </p>
          <div className="flex gap-1">
            <button 
              onClick={pagination.onPrev}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              Prev
            </button>
            <button 
              className="px-3 py-1.5 bg-blue-600 border border-blue-600 text-white rounded-lg text-xs font-semibold"
            >
              1
            </button>
            <button 
              onClick={pagination.onNext}
              className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Table;
