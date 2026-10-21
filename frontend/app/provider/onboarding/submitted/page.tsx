"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  ShieldCheck,
  CheckCircle2,
  FileText,
  HelpCircle,
  ArrowRight,
  Home,
  Headphones,
  PhoneCall,
  AlertCircle
} from "lucide-react";
import { API_URL } from "@/config/api";

export default function ProviderOnboardingSubmittedPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/provider/register");
          return;
        }

        const res = await fetch(`${API_URL}/providers/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setProvider(data);

          // If already approved, automatically redirect to active dashboard!
          const isApproved = data.onboarding_status ? data.onboarding_status === "APPROVED" : data.kyc_status === "verified";
          if (isApproved) {
            router.push("/provider/dashboard");
          }
        }
      } catch (e) {
        console.error("Failed to load provider status", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto w-full">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden text-center">
          {/* Header Banner */}
          <div className="bg-gradient-to-b from-blue-50/80 to-white py-12 px-6 flex flex-col items-center border-b border-slate-100">
            <div className="w-20 h-20 rounded-3xl bg-blue-100/70 border border-blue-200 text-[#1D2B83] flex items-center justify-center mb-6 shadow-md shadow-blue-500/10">
              <Clock size={42} strokeWidth={2.2} />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 mb-3">
              Status: Under Review
            </span>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Registration Submitted
            </h1>

            <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
              Our team will review your provider profile and verification documents.
            </p>
          </div>

          {/* Details Body */}
          <div className="p-6 sm:p-8 space-y-6 text-left">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">
                  Eligibility for Customer Jobs
                </p>
                <p className="leading-relaxed">
                  To ensure safety and quality standards, your account will become eligible for customer bookings only after our compliance team finishes reviewing your profile and KYC documents.
                </p>
              </div>
            </div>

            {/* What happens next */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
                What happens next?
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-sm">
                    1
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Document Audit</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Admin verifies your PAN, Aadhaar, and trade experience.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-sm">
                    2
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Account Approval</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Status changes to <strong className="text-emerald-600">Active</strong> and bank account is linked for payouts.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-sm">
                    3
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">Start Receiving Jobs</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Turn on availability in your partner dashboard and accept bookings!
                  </p>
                </div>
              </div>
            </div>

            {/* Provider Details Snapshot */}
            {provider && (
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Partner Code:</span>{" "}
                  <strong className="text-slate-800 font-mono">{provider.provider_code || "Generated on Approval"}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Application ID:</span>{" "}
                  <strong className="text-slate-800 font-mono">{String(provider.id || provider._id).slice(0, 12)}...</strong>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <Link
                href="/provider/dashboard"
                className="flex-1 py-3 px-4 bg-[#1D2B83] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-blue-900/10 text-center flex items-center justify-center gap-2"
              >
                <span>View Provider Dashboard Preview</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/"
                className="py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Home size={14} /> Home
              </Link>
              <Link
                href="/support"
                className="py-3 px-5 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Headphones size={14} /> Partner Help
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
