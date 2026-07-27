"use client";

import React from 'react';

interface RetryCardProps {
  title?: string;
  message?: string;
  onRetry: () => void;
  isLoading?: boolean;
}

export const RetryCard: React.FC<RetryCardProps> = ({
  title = "Couldn't load data",
  message = "Please check your network connection and try again.",
  onRetry,
  isLoading = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center my-4 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-4 text-xl">
        ⚠️
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-600 mb-6 leading-relaxed">{message}</p>
      <button
        onClick={onRetry}
        disabled={isLoading}
        className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm rounded-xl transition shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Retrying...
          </>
        ) : (
          'Retry'
        )}
      </button>
    </div>
  );
};

export default RetryCard;
