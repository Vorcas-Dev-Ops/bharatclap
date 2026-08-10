"use client";

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import { useSettings } from '@/context/SettingsContext';

export default function PrivacyPolicyPage() {
  const {
    companyName,
    platformName,
    supportEmail,
    companyAddress,
    legalDocuments,
  } = useSettings();

  const meta = legalDocuments?.privacy || {
    documentId: 'DOC-PRIV-2026-V2.4',
    version: '2.4',
    effectiveDate: '2026-08-08',
    lastUpdated: '2026-08-08',
    status: 'Published'
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* Dynamic CMS Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
              Legal &amp; Data Protection Policy
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {meta.documentId}
            </span>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-full border border-emerald-200">
              Version {meta.version}
            </span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-mono font-bold rounded-full border border-purple-200">
              Status: {meta.status}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>{meta.effectiveDate}</strong> | Last Updated: <strong>{meta.lastUpdated}</strong>
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          {/* Overview */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Overview &amp; Data Fiduciary
            </h2>
            <p>
              {companyName} (&quot;{platformName}&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates the {platformName} home services platform. We are dedicated to safeguarding your personal data and handling your privacy rights with total transparency in compliance with applicable Indian digital data protection laws.
            </p>
          </section>

          {/* Information Collected */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Information We Collect
            </h2>
            <p>We collect the following personal and technical data to facilitate doorstep service delivery:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#1D2B83]">Personal Identity &amp; Contact</h3>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                  <li><strong>Full Name &amp; Profile Picture</strong></li>
                  <li><strong>Phone Number</strong> (primary identity token)</li>
                  <li><strong>Email Address</strong> for invoices and support</li>
                  <li><strong>Saved Addresses</strong> with landmarks</li>
                </ul>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#1D2B83]">Location &amp; Navigation</h3>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                  <li><strong>GPS Coordinates:</strong> Collected strictly during active booking creation and provider navigation dispatch.</li>
                  <li><strong>Pin Codes &amp; Locality Data</strong></li>
                </ul>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#1D2B83]">Financial &amp; Transactions</h3>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                  <li><strong>Payment Tokens:</strong> Handled end-to-end through Razorpay. We store zero raw credit card or UPI PIN data.</li>
                  <li><strong>Transaction Records &amp; Invoices</strong></li>
                  <li><strong>Wallet Balance &amp; Credits</strong></li>
                </ul>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#1D2B83]">Technical &amp; App Data</h3>
                <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                  <li><strong>Device Info:</strong> OS version, device model, IP address.</li>
                  <li><strong>OTP Logs:</strong> 4-digit verification logs for job start/finish.</li>
                  <li><strong>In-App Support Chat &amp; Media Uploads</strong></li>
                  <li><strong>Notification Preferences</strong></li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Sharing */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Data Sharing &amp; Third Parties
            </h2>
            <p>
              <strong>We NEVER sell your personal data to third parties under any circumstances.</strong> Data is shared exclusively with necessary operational partners: Assigned Service Providers, Razorpay Payment Gateway, MSG91 SMS Service, and Firebase Cloud Messaging (FCM).
            </p>
          </section>

          {/* User Rights */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              4. Data Retention &amp; Your Privacy Rights
            </h2>
            <p className="text-xs text-slate-600">
              Invoices retained for 7 years for GST compliance. To request account deletion or data access, contact our Data Protection Officer at <code>{supportEmail}</code> or write to <code>{companyAddress}</code> referencing <code>{meta.documentId}</code>.
            </p>
          </section>

          {/* Account Deletion & Payment Disclosures */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              5. Provider Account Deletion &amp; Payments
            </h2>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p>
                Deleting your BharatClap provider account does not automatically refund subscription plans, available plans, lead packages, promotional credits, free-trial credits, or sponsored credits. These amounts are subject to the applicable plan, wallet, and promotional terms.
              </p>
              <p>
                Any earnings owed to you for completed services will be processed through the applicable settlement process, subject to outstanding liabilities, disputes, verification, and the normal settlement cycle.
              </p>
              <p>
                Purchased wallet balances, where applicable, are reviewed according to the applicable wallet terms and may require administrative review.
              </p>
              <p>
                We may retain invoices, payment, settlement, tax, fraud-prevention, and other legally required records after account deletion. Personal information that is not required for these purposes will be deleted or anonymized according to our account-deletion policy.
              </p>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
