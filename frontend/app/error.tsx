"use client";

import React, { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[UNHANDLED REACT EXCEPTION]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50/50 text-center font-sans">
      <div className="w-20 h-20 bg-rose-100/80 rounded-full flex items-center justify-center mb-6 text-4xl shadow-inner">
        🚨
      </div>
      <h1 className="text-3xl font-extrabold text-slate-800 mb-2">Something went wrong</h1>
      <p className="text-slate-600 max-w-md mb-8 leading-relaxed text-sm">
        An unexpected application error occurred. No data was lost. Please try reloading the page.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => reset()}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl transition shadow hover:shadow-md"
        >
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
