import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
      <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 text-5xl select-none">
        🔍
      </div>
      <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-slate-500 max-w-md mb-8 leading-relaxed text-sm">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl transition shadow hover:shadow-md"
        >
          Go Home
        </Link>
        <Link
          href="/services"
          className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition"
        >
          Browse Services
        </Link>
      </div>
    </div>
  );
}
