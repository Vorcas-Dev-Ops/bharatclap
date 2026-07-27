"use client";

import React from 'react';
import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
  };
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  backHref,
  backLabel = "Back",
  action,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline mb-1 inline-flex items-center gap-1 transition"
          >
            ← {backLabel}
          </Link>
        )}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && <p className="text-xs text-slate-500 mt-0.5 font-medium">{description}</p>}
      </div>

      {action && (
        <div>
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition"
            >
              {action.icon}
              <span>{action.label}</span>
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-sm transition"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
