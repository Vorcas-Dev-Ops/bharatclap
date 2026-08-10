"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function CommunityGuidelinesPage() {
  const {
    companyName,
    platformName,
    supportPhone,
    supportEmail,
    lastUpdated,
  } = useSettings();

  const docId = `DOC-COMM-2026-V2.0`;

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        
        {/* Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Community Conduct Code
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {docId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version 2.0
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Community Guidelines</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>August 7, 2026</strong> | Last Updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Respectful &amp; Courteous Interaction
            </h2>
            <p>
              {platformName} brings service professionals directly into your home or office. Both customers and providers are expected to interact with mutual respect, dignity, and professionalism. Discrimination based on caste, religion, gender, background, or physical ability is strictly prohibited.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Core Community Rules
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-red-600 uppercase tracking-wider">Zero Harassment &amp; Abuse</h3>
                <p className="text-slate-600">Verbal threats, inappropriate physical conduct, or non-consensual contact results in immediate police report and permanent platform ban.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-red-600 uppercase tracking-wider">No Off-Platform Payments</h3>
                <p className="text-slate-600">Soliciting cash payments outside {platformName} to bypass service warranties or platform commission voids all customer protection guarantees.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-red-600 uppercase tracking-wider">Authentic Reviews Only</h3>
                <p className="text-slate-600">Posting fake reviews, extortion ratings, or coordinated negative feedback campaigns leads to review removal and account restriction.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-red-600 uppercase tracking-wider">No Fraud or Account Sharing</h3>
                <p className="text-slate-600">Sharing account credentials, creating duplicate referral accounts, or submitting false booking claims is illegal and strictly audited.</p>
              </div>
            </div>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Reporting Violations
            </h2>
            <p className="text-xs text-slate-600">
              To report a violation referencing <code>{docId}</code>, dial <code>{supportPhone}</code> or email <code>{supportEmail}</code>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
