"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function ProviderGuidelinesPage() {
  const {
    companyName,
    platformName,
    supportPhone,
    policiesVersion,
    lastUpdated,
  } = useSettings();

  const docId = `DOC-PROV-2026-${policiesVersion.toUpperCase()}`;

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        
        {/* Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Service Partner Quality Standard
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {docId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version {policiesVersion}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Provider Guidelines</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>August 7, 2026</strong> | Last Updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Code of Conduct &amp; Professionalism
            </h2>
            <p>
              As a verified {platformName} Service Partner, you represent our commitment to quality, trust, and safety. Partners must maintain clean grooming, wear official {platformName} apron/uniform, carry valid physical ID badges, and communicate politely with customers at all times.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Core Operating Expectations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Punctuality &amp; Arrival</h3>
                <p className="text-slate-600">Arrive at customer location within the designated 30-minute slot window. Notify customer in app if unexpected traffic causes a delay.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Compulsory 4-Digit OTP</h3>
                <p className="text-slate-600">Always request the 4-digit OTP from customer upon job completion. Never press completed without valid customer OTP input.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Service Quality &amp; Cleanliness</h3>
                <p className="text-slate-600">Use genuine branded spare parts and clean up the work area thoroughly after finishing service delivery.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Zero Cash Misconduct</h3>
                <p className="text-slate-600">Never demand cash over-payments or negotiate off-platform services. All billing must pass through {platformName} invoice.</p>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Safety Protocols &amp; Helpline
            </h2>
            <p className="text-xs text-slate-600">
              Partners must follow strict safety standards. In case of emergency or safety disputes during a job, call Partner Support helpline immediately at <code>{supportPhone}</code> referencing <code>{docId}</code>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
