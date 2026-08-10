"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function RefundPolicyPage() {
  const {
    companyName,
    platformName,
    supportPhone,
    supportEmail,
    policiesVersion,
    lastUpdated,
  } = useSettings();

  const docId = `DOC-RFND-2026-${policiesVersion.toUpperCase()}`;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Cancellation &amp; Refund Rules
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {docId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version {policiesVersion}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Refund &amp; Cancellation Policy</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>August 7, 2026</strong> | Last Updated: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          {/* Customer Cancellation */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Customer Cancellations
            </h2>
            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <strong className="text-emerald-900">Free Cancellation Window:</strong>
                <p className="text-emerald-800 mt-1">Cancel for free up to 1 hour prior to scheduled slot time. 100% of prepaid funds are immediately queued for refund.</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <strong className="text-amber-900">Late Cancellation Fee:</strong>
                <p className="text-amber-800 mt-1">Cancellations made within 1 hour of the scheduled time or after provider dispatch incur a ₹99 fee to cover provider transit.</p>
              </div>
            </div>
          </section>

          {/* Unassigned Timeout Auto-Refund */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Unassigned Timeout Auto-Refund
            </h2>
            <p className="text-xs text-slate-600">
              If no provider accepts your booking request within the dispatch timeout period (60 minutes), the system automatically transitions your booking to <code>unassigned_timeout</code> and queues a 100% full refund.
            </p>
          </section>

          {/* Refund Processing Timelines */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Processing Timelines &amp; Methods
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="font-black text-[#1D2B83] text-sm mb-1">{platformName} Wallet</div>
                <div className="text-emerald-600 font-bold">Instant (0–15 Mins)</div>
                <div className="text-[11px] text-slate-500 mt-1">Usable for future bookings or bank withdrawal.</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="font-black text-[#1D2B83] text-sm mb-1">UPI Payments</div>
                <div className="text-slate-800 font-bold">2 to 24 Hours</div>
                <div className="text-[11px] text-slate-500 mt-1">Processed via Razorpay UPI auto-refund API.</div>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                <div className="font-black text-[#1D2B83] text-sm mb-1">Credit / Debit Cards</div>
                <div className="text-slate-800 font-bold">3 to 5 Business Days</div>
                <div className="text-[11px] text-slate-500 mt-1">Subject to your card issuing bank clearance cycles.</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 pt-2">
              To raise a refund request referencing <code>{docId}</code>, call <code>{supportPhone}</code> or email <code>{supportEmail}</code>.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
