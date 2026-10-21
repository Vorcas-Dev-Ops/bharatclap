"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Check, 
  Percent, 
  Headphones,
  Award
} from "lucide-react";
import { API_URL } from "@/config/api";

export default function AccessPlanPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"FREE" | "SUBSCRIPTION">("FREE");
  const [showReadyModal, setShowReadyModal] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("jwt");
        if (!token) {
          router.replace("/login");
          return;
        }

        const res = await fetch(`${API_URL}/providers/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const data = await res.json();
          setProvider(data);

          // If not approved yet, must go to pending
          if (data.onboarding_status !== "APPROVED") {
            router.replace("/provider/pending");
            return;
          }

          // If kit is not paid, must go to kit payment first
          if (data.kit_payment_status !== "PAID") {
            router.replace("/provider/onboarding/kit");
            return;
          }

          // If kit is not collected yet, must go to kit collection
          if (data.kit_collection_status !== "COLLECTED") {
            router.replace("/provider/onboarding/kit-collection");
            return;
          }

          // If access is already active, go straight to dashboard
          if (data.access_status === "ACTIVE") {
            router.replace("/provider/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load provider profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [router]);

  const handleActivatePlan = async (planType: "FREE" | "SUBSCRIPTION") => {
    setActivating(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/providers/access-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan_type: planType })
      });

      if (res.ok) {
        setShowReadyModal(true);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Failed to activate access plan. Please try again.");
      }
    } catch (e: any) {
      alert(e.message || "Network error. Please try again.");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]" />
          <p className="text-slate-500 font-medium">Loading access options…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <CheckCircle2 size={16} className="text-emerald-500" /> Provider Kit Paid & Verified
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Choose Your Access Plan
          </h1>
          <p className="text-slate-600 max-w-xl mx-auto text-base">
            Select how you would like to operate on BharatClap. You can start with our standard Free Access or subscribe for lower commission and priority dispatch.
          </p>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Card 1: Free Access */}
          <div 
            onClick={() => setSelectedPlan("FREE")}
            className={`cursor-pointer relative bg-white rounded-3xl p-8 border-2 transition-all flex flex-col justify-between shadow-sm hover:shadow-xl ${
              selectedPlan === "FREE" ? "border-[#1D2B83] ring-4 ring-[#1D2B83]/10" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Standard Access</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">Free Access</h3>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === "FREE" ? "border-[#1D2B83] bg-[#1D2B83]" : "border-slate-300"
                }`}>
                  {selectedPlan === "FREE" && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">₹0</span>
                <span className="text-slate-500 font-medium text-sm"> / forever</span>
                <p className="text-xs text-slate-500 mt-1">No monthly subscription fees</p>
              </div>

              <ul className="space-y-3.5 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Receive customer booking requests directly</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Standard platform commission only on completed jobs</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Instant account activation & Go Online privilege</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Check size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Standard in-app navigation & customer calling</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={activating}
              onClick={(e) => {
                e.stopPropagation();
                handleActivatePlan("FREE");
              }}
              className="w-full py-4 bg-[#1D2B83] hover:bg-blue-900 text-white font-bold rounded-2xl shadow-lg shadow-blue-950/20 transition-all flex items-center justify-center gap-2"
            >
              {activating && selectedPlan === "FREE" ? "Activating..." : (
                <>
                  Continue with Free Access <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>

          {/* Card 2: Subscription Plan */}
          <div 
            onClick={() => setSelectedPlan("SUBSCRIPTION")}
            className={`cursor-pointer relative bg-white rounded-3xl p-8 border-2 transition-all flex flex-col justify-between shadow-sm hover:shadow-xl ${
              selectedPlan === "SUBSCRIPTION" ? "border-amber-500 ring-4 ring-amber-500/10" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="absolute -top-3.5 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
              PRO PARTNER
            </div>

            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Premium Growth</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">Subscription Plan</h3>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === "SUBSCRIPTION" ? "border-amber-500 bg-amber-500" : "border-slate-300"
                }`}>
                  {selectedPlan === "SUBSCRIPTION" && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                </div>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-black text-slate-900">₹499</span>
                <span className="text-slate-500 font-medium text-sm"> / month</span>
                <p className="text-xs text-amber-700 font-semibold mt-1">Save up to 40% on platform commissions</p>
              </div>

              <ul className="space-y-3.5 mb-8">
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Zap size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Priority dispatch ranking</strong> for nearest service requests</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Percent size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span><strong>Zero or heavily discounted commission</strong> per booking</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Award size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>"Verified Pro" badge on customer search listings</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-700">
                  <Headphones size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>Dedicated priority partner support hotline</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              disabled={activating}
              onClick={(e) => {
                e.stopPropagation();
                handleActivatePlan("SUBSCRIPTION");
              }}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2"
            >
              {activating && selectedPlan === "SUBSCRIPTION" ? "Activating..." : (
                <>
                  Activate Subscription Plan <Sparkles size={18} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security & Guarantee Note */}
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>BharatClap Verified Partner Guarantee • Switch access plans at any time from your settings</span>
        </div>
      </div>

      {/* Activation Success / Ready Modal */}
      {showReadyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600">
              <CheckCircle2 size={44} />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-2">
              🎉 You're Ready!
            </h2>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Your BharatClap provider account is now fully active. You can go online and start receiving service requests based on your selected services and operating locations.
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-500">Access Status</span>
                <span className="text-emerald-600 uppercase">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-500">Starter Kit</span>
                <span className="text-emerald-600 uppercase">PAID & VERIFIED</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-500">Dispatch Eligibility</span>
                <span className="text-[#1D2B83] uppercase">ELIGIBLE</span>
              </div>
            </div>

            <button
              onClick={() => router.push("/provider/dashboard")}
              className="w-full py-4 bg-[#1D2B83] text-white rounded-2xl font-bold hover:bg-blue-900 transition-all shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2"
            >
              Go Online & Start <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
