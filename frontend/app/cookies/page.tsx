"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function CookiePolicyPage() {
  const {
    companyName,
    platformName,
    policiesVersion,
    lastUpdated,
  } = useSettings();

  const docId = `DOC-COOK-2026-V1.2`;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Privacy &amp; Cookie Disclosure
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {docId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version 1.2
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Cookie Policy</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>August 7, 2026</strong> | Last Updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. What Are Cookies?
            </h2>
            <p>
              Cookies are small text files stored on your browser or mobile device when accessing {platformName}. {companyName} uses essential authentication tokens, session data, and preference storage to deliver seamless service dispatch.
            </p>
          </section>

          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Categories of Cookies We Use
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Authentication Cookies</h3>
                <p className="text-slate-600">Essential JWT tokens stored securely to keep your session authenticated across navigation.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Session &amp; Cart Cookies</h3>
                <p className="text-slate-600">Temporarily retain selected service packages, slot times, and address selections.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Analytics Cookies</h3>
                <p className="text-slate-600">Gather anonymized traffic metrics to evaluate page load speeds and app performance.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83] uppercase tracking-wider">Preference Cookies</h3>
                <p className="text-slate-600">Remember UI choices such as dark mode toggles and saved locality pincodes.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
