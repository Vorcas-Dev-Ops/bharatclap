import React from 'react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center font-sans">
      <div className="w-20 h-20 bg-rose-100/80 text-rose-600 rounded-full flex items-center justify-center mb-6 text-4xl select-none">
        ⛔
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Access Denied</h1>
      <p className="text-slate-600 max-w-md mb-8 leading-relaxed text-sm">
        You don&apos;t have permission to access this page. Please log in with an authorized account or contact support.
      </p>
      <div className="flex items-center gap-3">
        <Link
          href="/login"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl transition shadow hover:shadow-md"
        >
          Log In
        </Link>
        <Link
          href="/"
          className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
