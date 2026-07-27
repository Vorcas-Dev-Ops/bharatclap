"use client";

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-100 font-sans text-center">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 text-3xl">
          💥
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Critical Application Error</h1>
        <p className="text-sm text-slate-600 max-w-sm mb-6">
          The layout failed to initialize. Click reload to restore the session.
        </p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700 transition"
        >
          Reload Application
        </button>
      </body>
    </html>
  );
}
