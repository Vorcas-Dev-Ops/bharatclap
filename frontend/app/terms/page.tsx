"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function TermsPage() {
  const {
    companyName,
    platformName,
    supportPhone,
    supportEmail,
    policiesVersion,
    lastUpdated,
  } = useSettings();

  const docId = `DOC-TRMS-2026-${policiesVersion.toUpperCase()}`;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Platform Terms Agreement
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {docId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version {policiesVersion}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Terms &amp; Conditions</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>August 7, 2026</strong> | Last Updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          {/* Agreement */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Agreement to Terms
            </h2>
            <p>
              By accessing or using the {platformName} platform, you agree to be bound by these Terms and Conditions. {companyName} (&quot;{platformName}&quot;) operates an aggregation platform connecting verified independent service professionals (&quot;Providers&quot;) with registered customers (&quot;Users&quot;).
            </p>
          </section>

          {/* Responsibilities */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. User &amp; Provider Responsibilities
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h3 className="font-bold uppercase tracking-wider text-[#1D2B83]">Customer Responsibilities</h3>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Provide accurate delivery address and location landmarks.</li>
                  <li>Ensure safe working environment, water, and power utilities.</li>
                  <li>Inspect completed work before sharing job completion OTP.</li>
                  <li>Zero tolerance for harassment of service partners.</li>
                </ul>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <h3 className="font-bold uppercase tracking-wider text-[#1D2B83]">Provider Responsibilities</h3>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Maintain verified KYC, trade certification, and active background checks.</li>
                  <li>Arrive in official uniform carrying physical ID badge during slot time.</li>
                  <li>Collect mandatory 4-digit OTP to verify service completion.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* OTP Verification Security */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Mandatory 4-Digit OTP Security Protocol
            </h2>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <strong>SECURITY VERIFICATION:</strong>
              <p>
                Service completion is authorized solely through a unique 4-digit OTP sent to your registered mobile device. Do NOT share your completion OTP with the provider until the service has been fully delivered to your satisfaction.
              </p>
            </div>
          </section>

          {/* Payments & Disclaimers */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              4. Governing Law &amp; Support Contact
            </h2>
            <p className="text-xs text-slate-600">
              These terms are governed by the laws of India. For dispute resolution or policy inquiries referencing <code>{docId}</code>, dial <code>{supportPhone}</code> or email <code>{supportEmail}</code>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
