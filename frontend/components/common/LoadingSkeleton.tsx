"use client";

import React from 'react';

export const CardSkeleton: React.FC = () => (
  <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm animate-pulse space-y-4">
    <div className="h-40 bg-slate-200/70 rounded-xl w-full" />
    <div className="h-4 bg-slate-200/70 rounded w-3/4" />
    <div className="h-3 bg-slate-200/70 rounded w-1/2" />
    <div className="flex justify-between items-center pt-2">
      <div className="h-5 bg-slate-200/70 rounded w-1/4" />
      <div className="h-8 bg-slate-200/70 rounded-lg w-1/3" />
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3 animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center space-x-4 py-2 border-b border-slate-50 last:border-0">
        <div className="w-10 h-10 bg-slate-200/70 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-slate-200/70 rounded w-1/3" />
          <div className="h-3 bg-slate-200/70 rounded w-1/4" />
        </div>
        <div className="h-6 bg-slate-200/70 rounded w-16" />
      </div>
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);
