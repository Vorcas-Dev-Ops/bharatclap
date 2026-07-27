"use client";

import React from 'react';

type StatusType =
  | 'completed'
  | 'approved'
  | 'success'
  | 'pending'
  | 'processing'
  | 'manual_review'
  | 'failed'
  | 'rejected'
  | 'cancelled';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  const normalized = status.toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';

  if (['completed', 'approved', 'success'].includes(normalized)) {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    dotColor = 'bg-emerald-500';
  } else if (['pending', 'processing', 'manual_review'].includes(normalized)) {
    styles = 'bg-amber-50 text-amber-700 border-amber-200/60';
    dotColor = 'bg-amber-500';
  } else if (['failed', 'rejected', 'cancelled'].includes(normalized)) {
    styles = 'bg-rose-50 text-rose-700 border-rose-200/60';
    dotColor = 'bg-rose-500';
  }

  const displayText = label || status.replace('_', ' ').toUpperCase();

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-md border ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {displayText}
    </span>
  );
};

export default StatusBadge;
