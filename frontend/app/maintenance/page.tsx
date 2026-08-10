import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Under Maintenance — BharatClap',
  description: 'BharatClap is undergoing scheduled system upgrades. We will be back online shortly.',
};

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-center font-sans text-white">
      <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 text-4xl border border-indigo-500/20 shadow-inner">
        ⚙️
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight mb-3">System Scheduled Maintenance</h1>
      <p className="text-slate-400 max-w-md mb-8 leading-relaxed text-sm">
        BharatClap is currently undergoing scheduled platform performance enhancements. All active bookings are unaffected.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-semibold border border-indigo-500/20 mb-8">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Estimated Back Online: 15 Minutes
      </div>
      <div>
        <Link
          href="/"
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition shadow"
        >
          Check Again
        </Link>
      </div>
    </div>
  );
}
