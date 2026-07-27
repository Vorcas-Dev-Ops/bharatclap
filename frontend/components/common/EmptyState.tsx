"use client";

import React from 'react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📂',
  title,
  description,
  actionText,
  actionHref,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-10 bg-white rounded-2xl border border-slate-100 shadow-sm text-center my-6 max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-full bg-slate-100/80 flex items-center justify-center mb-4 text-3xl select-none">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-6">{description}</p>
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition shadow-sm hover:shadow"
        >
          {actionText}
        </Link>
      )}
      {actionText && !actionHref && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-xl transition shadow-sm hover:shadow"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
