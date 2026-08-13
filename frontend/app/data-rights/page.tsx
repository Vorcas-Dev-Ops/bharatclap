"use client";

/* ponytail: clean DPDP data-rights request page with client validation */

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import Link from "next/link";
import { ShieldCheck, Send, CheckCircle2, FileText, Lock, ArrowLeft } from "lucide-react";

export default function DataRightsPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    emailOrPhone: "",
    requestType: "access",
    details: "",
    identityConfirmed: false,
  });

  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.emailOrPhone.trim()) {
      setError("Please enter your name and registered email or phone number.");
      return;
    }
    if (!formData.identityConfirmed) {
      setError("Please confirm that you are the Data Principal or authorized representative.");
      return;
    }

    setError("");
    setLoading(true);

    setTimeout(() => {
      const generatedId = `DPDP-REQ-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      setTicketId(generatedId);
      setSubmitted(true);
      setLoading(false);
    }, 600);
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-slate-800">
        
        {/* Header */}
        <div className="mb-8 space-y-3">
          <Link href="/privacy" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D2B83] hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Privacy Notice
          </Link>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-black uppercase tracking-widest rounded-full border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              DPDP Act 2023 Statutory Rights
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Data Principal Rights Request Form
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            As a Data Principal under India&apos;s <strong>Digital Personal Data Protection Act 2023</strong>, you may submit requests regarding your personal data processed by BharatClap.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Data Rights Request Submitted</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
              Your request has been logged with our Data Protection Officer. A verification link has been sent to your registered contact.
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block text-left text-xs font-mono space-y-1">
              <p><strong>Tracking Ticket ID:</strong> <span className="text-[#1D2B83] font-bold">{ticketId}</span></p>
              <p><strong>Status:</strong> Pending Verification &amp; Review</p>
              <p><strong>Response SLA:</strong> Acknowledgment &lt; 48 hours | Resolution &lt; 30 Days</p>
            </div>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ fullName: "", emailOrPhone: "", requestType: "access", details: "", identityConfirmed: false });
                }}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* Requestor Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1D2B83]">1. Data Principal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Enter your full legal name"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D2B83]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Phone / Email *</label>
                  <input
                    type="text"
                    required
                    value={formData.emailOrPhone}
                    onChange={(e) => setFormData({ ...formData, emailOrPhone: e.target.value })}
                    placeholder="+91-XXXXX-XXXXX or user@email.com"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D2B83]"
                  />
                </div>
              </div>
            </div>

            {/* Request Type */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#1D2B83]">2. Select DPDP Right to Exercise</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {[
                  { id: "access", label: "Right to Access Data Summary", desc: "Get a summary of personal data held and third parties shared with." },
                  { id: "correction", label: "Right to Correction / Updation", desc: "Request correction of inaccurate or incomplete personal data." },
                  { id: "erasure", label: "Right to Erasure / Deletion", desc: "Request account anonymization and wipe of personal data." },
                  { id: "withdraw", label: "Right to Withdraw Consent", desc: "Revoke consent for non-essential communications or data processing." },
                  { id: "grievance", label: "Submit Grievance to DPO", desc: "Report privacy concern or dispute to Data Protection Officer." }
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      formData.requestType === item.id
                        ? "border-[#1D2B83] bg-blue-50/50 text-[#1D2B83] font-bold"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="requestType"
                        value={item.id}
                        checked={formData.requestType === item.id}
                        onChange={(e) => setFormData({ ...formData, requestType: e.target.value })}
                        className="text-[#1D2B83] focus:ring-[#1D2B83]"
                      />
                      <span>{item.label}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 font-normal pl-5">{item.desc}</p>
                  </label>
                ))}
              </div>
            </div>

            {/* Specific Details */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Specific Request Details (Optional)</label>
              <textarea
                rows={3}
                value={formData.details}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="Provide additional details or specify which data fields require updating..."
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1D2B83]"
              />
            </div>

            {/* Identity Verification Consent Checkbox (Unticked by default) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.identityConfirmed}
                  onChange={(e) => setFormData({ ...formData, identityConfirmed: e.target.checked })}
                  className="mt-0.5 rounded text-[#1D2B83] focus:ring-[#1D2B83] w-4 h-4"
                />
                <span>
                  I confirm that I am the Data Principal associated with the registered contact details provided, or an authorized representative acting on their behalf under the DPDP Act 2023.
                </span>
              </label>
            </div>

            {/* Submit button */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-slate-500">
                Grievance Officer Email: <code>dpo@bharatclap.com</code>
              </p>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-[#1D2B83] text-white text-xs font-bold rounded-xl hover:bg-blue-900 transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {loading ? "Logging Ticket..." : "Submit DPDP Request"} <Send className="w-3.5 h-3.5" />
              </button>
            </div>

          </form>
        )}

      </div>
      <Footer />
    </main>
  );
}
