"use client";

/* ponytail: legal copy marked for lawyer review - DPDP Act 2023 & DPDP Rules 2026 */

import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';
import { ShieldCheck, Mail, FileText, Lock, UserCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const {
    companyName,
    platformName,
    supportEmail,
    companyAddress,
    legalDocuments,
  } = useSettings();

  const meta = legalDocuments?.privacy || {
    documentId: 'DOC-PRIV-2026-DPDP',
    version: '3.0-DPDP',
    effectiveDate: '2026-08-13',
    lastUpdated: '2026-08-13',
    status: 'Published (Lawyer Review Pending)'
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* DPDP Compliance Header Block */}
        <div className="mb-10 text-center sm:text-left space-y-3">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-black uppercase tracking-widest rounded-full border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              DPDP Act (India) 2023 Notice
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-[10px] font-mono font-bold rounded-full border border-amber-200">
              LEGAL COPY - LAWYER REVIEW PENDING
            </span>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-full border border-slate-200">
              {meta.documentId}
            </span>
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-mono font-bold rounded-full border border-purple-200">
              Version {meta.version}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Privacy Policy &amp; Digital Personal Data Notice
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Effective Date: <strong>{meta.effectiveDate}</strong> | Last Updated: <strong>{meta.lastUpdated}</strong>
          </p>
        </div>

        {/* Lawyer Review Alert Banner */}
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>LEGAL DISCLAIMER (MARK FOR LAWYER REVIEW):</strong>
            <p className="mt-1 text-amber-800">
              This Privacy Notice is designed to comply with the Digital Personal Data Protection (DPDP) Act 2023 of India. The contents are subject to final advocate sign-off.
            </p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-700">
          
          {/* Section 1: Overview & Data Fiduciary */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              1. Data Fiduciary Identity &amp; Overview
            </h2>
            <p>
              {companyName} (&quot;{platformName}&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is the <strong>Data Fiduciary</strong> operating the {platformName} doorstep home services platform in India. Under the Digital Personal Data Protection Act (DPDP) 2023, we are committed to processing your personal data lawfully, fairly, and transparently based on your explicit consent or legitimate legal grounds.
            </p>
          </section>

          {/* Section 2: Personal Data Collected & Purpose */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              2. Personal Data We Collect &amp; Lawful Purpose
            </h2>
            <p>We process only such personal data as is necessary for the specified purposes of doorstep service delivery and platform operation:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1D2B83]">Personal Identity &amp; Contact</h3>
                <p className="text-xs text-slate-600"><strong>Data:</strong> Full Name, Primary Phone Number, Email Address, Gender.</p>
                <p className="text-xs text-slate-500"><strong>Purpose:</strong> Account creation, OTP authentication, booking updates, support communications.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1D2B83]">Location &amp; Delivery Address</h3>
                <p className="text-xs text-slate-600"><strong>Data:</strong> Saved Addresses, Landmarks, GPS Coordinates (collected during active booking).</p>
                <p className="text-xs text-slate-500"><strong>Purpose:</strong> Service provider dispatch, doorstep fulfillment, serviceability checks.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1D2B83]">Financial &amp; Invoicing Data</h3>
                <p className="text-xs text-slate-600"><strong>Data:</strong> Payment Tokens (handled via Razorpay), Transaction IDs, GST Invoices.</p>
                <p className="text-xs text-slate-500"><strong>Purpose:</strong> Processing payments, wallet settlements, statutory tax compliance.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1D2B83]">Provider KYC &amp; Verification</h3>
                <p className="text-xs text-slate-600"><strong>Data:</strong> Govt IDs (Aadhaar, PAN), Bank Account details, Trade Certificates, Photos.</p>
                <p className="text-xs text-slate-500"><strong>Purpose:</strong> Verification of independent partners, fraud prevention, RazorpayX payouts.</p>
              </div>
            </div>
          </section>

          {/* Section 3: Data Retention Periods */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              3. Data Retention Schedule
            </h2>
            <p>We retain personal data only for as long as necessary to fulfill the purpose of collection or satisfy statutory legal obligations:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
              <li><strong>User Profile &amp; Account Data:</strong> Retained for active account duration plus 30 days post-deletion request (cooling period).</li>
              <li><strong>Tax &amp; Financial Records:</strong> Retained for <strong>7 years</strong> from the transaction date per Indian GST &amp; Income Tax Acts.</li>
              <li><strong>Provider KYC Records:</strong> Retained for <strong>5 years</strong> post-termination of partner agreement under Prevention of Money-Laundering rules.</li>
              <li><strong>Technical Logs &amp; OTP Records:</strong> Automatically purged or anonymized after 90 days.</li>
            </ul>
          </section>

          {/* Section 4: Third-Party Data Processors */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              4. Third-Party Data Processors
            </h2>
            <p>We do NOT sell your personal data. Data is shared strictly with authorized data processors under binding data-protection agreements:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong>Razorpay / RazorpayX:</strong> Payment gateway &amp; partner payout settlement handling.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong>MSG91:</strong> Transactional SMS and OTP notification delivery.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong>Firebase Cloud Messaging (FCM):</strong> In-app push alerts and updates.
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <strong>Google Maps API:</strong> Address geocoding and live navigation mapping.
              </div>
            </div>
          </section>

          {/* Section 5: Rights of Data Principals (DPDP Act 2023) */}
          <section className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#1D2B83]"></span>
              5. Your Rights as a Data Principal (DPDP Act 2023)
            </h2>
            <p>Under Section 11–14 of the DPDP Act 2023, you hold the following statutory rights regarding your personal data:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 space-y-1">
                <h3 className="font-bold text-[#1D2B83]">Right to Access Information</h3>
                <p className="text-slate-600">Request a summary of personal data processed and identities of data processors shared with.</p>
              </div>
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1">
                <h3 className="font-bold text-emerald-900">Right to Correction &amp; Erasure</h3>
                <p className="text-slate-600">Request correction of inaccurate data or deletion of personal data no longer legally required.</p>
              </div>
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 space-y-1">
                <h3 className="font-bold text-purple-900">Right to Withdraw Consent</h3>
                <p className="text-slate-600">Withdraw consent for non-essential data processing at any time without affecting past processing validity.</p>
              </div>
              <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-100 space-y-1">
                <h3 className="font-bold text-amber-900">Right to Grievance Redressal</h3>
                <p className="text-slate-600">Directly contact our Data Protection Officer for swift redressal of privacy concerns.</p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href="/data-rights"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D2B83] text-white text-xs font-bold rounded-xl hover:bg-blue-900 transition-colors"
              >
                Submit Data Rights Request <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* Section 6: Grievance Officer Contact Details */}
          <section id="grievance" className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">6. Data Protection &amp; Grievance Officer</h2>
                <p className="text-xs text-slate-400">Section 10(2) DPDP Act Statutory Contact</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If you have any questions, concerns, or grievances regarding the processing of your personal data or wish to exercise your DPDP rights, contact our designated Grievance Officer:
            </p>

            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-xs space-y-2 text-slate-300">
              <p><strong>Name / Designation:</strong> Data Protection Officer &amp; Grievance Officer</p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400" />
                <strong>Email:</strong> <code>dpo@bharatclap.com</code> / <code>privacy@bharatclap.com</code>
              </p>
              <p><strong>Postal Address:</strong> {companyAddress || "BharatClap Legal Dept, Bengaluru, Karnataka, India"}</p>
              <p><strong>Response SLA:</strong> Acknowledgment within 48 hours; resolution within 30 days per DPDP Rules.</p>
            </div>
          </section>

        </div>
      </div>
      <Footer />
    </main>
  );
}
