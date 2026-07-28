import React from 'react';

export default function AdminLoading() {
  return (
    <div className="w-full min-h-[400px] flex flex-col items-center justify-center gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Loading View...</p>
    </div>
  );
}
