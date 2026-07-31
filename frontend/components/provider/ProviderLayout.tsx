"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import ProviderProfileModal from "./modals/ProviderProfileModal";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/utils/authFetch";
import { API_URL } from "@/config/api";
import { Sparkles, CreditCard, X } from "lucide-react";

interface ProviderLayoutProps {
  children: React.ReactNode;
}

export default function ProviderLayout({ children }: ProviderLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingProviderStatus, setCheckingProviderStatus] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showRechargeBanner, setShowRechargeBanner] = useState(false);
  const [providerDetails, setProviderDetails] = useState<any>(null);

  const { user, isLoading: isAuthLoading, isReconnecting, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthLoading || isReconnecting) return;

    if (!isAuthenticated || user?.role !== "provider") {
      window.location.replace("/login");
      return;
    }

    const checkProviderKyc = async () => {
      const isExempt =
        pathname.includes("/provider/pending") ||
        pathname.includes("/provider/onboarding");

      // Warm-start: If already verified in this session, render immediately without blocking UI
      if (typeof window !== "undefined" && sessionStorage.getItem("provider_kyc_verified") === "true" && !isExempt) {
        setCheckingProviderStatus(false);
      }

      if (!isExempt) {
        try {
          const response = await authFetch(`${API_URL}/providers/me`);
          if (response.ok) {
            const data = await response.json();
            setProviderDetails(data);

            if (data.kyc_status !== "verified") {
              sessionStorage.removeItem("provider_kyc_verified");
              router.push("/provider/pending");
              return;
            }

            sessionStorage.setItem("provider_kyc_verified", "true");

            const isFreeAccess = data.isFreeAccessEnabled || ['active', 'free_trial', 'grace_period'].includes(data.subscriptionStatus);
            const availCredit = data.availableCredit ?? ((data.walletBalance || 0) - (data.reservedBalance || 0) + (data.creditLimit || 0));
            const hasRecharge = data.kitPurchased && availCredit >= 0;

            if (!data.kitPurchased && !isFreeAccess) {
              setShowPaymentReminder(true);
            } else {
              setShowPaymentReminder(false);
            }

            // If account has neither active free trial/subscription nor valid recharge
            if (!isFreeAccess && !hasRecharge) {
              setShowRechargeBanner(true);
              const modalDismissed = sessionStorage.getItem("recharge_modal_dismissed");
              if (!modalDismissed) {
                setShowRechargeModal(true);
              }
            } else {
              setShowRechargeBanner(false);
              setShowRechargeModal(false);
            }
          }
        } catch (err) {
          console.error("Error fetching provider status:", err);
        }
      }
      setCheckingProviderStatus(false);
    };

    checkProviderKyc();

    if (window.location.search.includes("edit=profile")) {
      setProfileModalOpen(true);
      window.history.replaceState({}, "", pathname);
    }

    const handleOpenProfile = () => setProfileModalOpen(true);
    window.addEventListener("openProviderProfile", handleOpenProfile);
    return () =>
      window.removeEventListener("openProviderProfile", handleOpenProfile);
  }, [isAuthLoading, isAuthenticated, user, router, pathname]);

  if (isAuthLoading || checkingProviderStatus || !isAuthenticated || user?.role !== "provider") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]"></div>
          <p className="text-slate-500 font-medium animate-pulse">
            Verifying access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:pl-64 w-full">
        <TopNavbar onOpenSidebar={() => setSidebarOpen(true)} />

        <main className="flex-1 px-4 lg:px-8 pt-6 pb-8 w-full mt-16">
          {showPaymentReminder && !pathname.includes("/provider/onboarding") && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-xl">⚠️</span>
                <div>
                  <span className="font-black block text-red-950">Starter Kit Payment Mandatory</span>
                  <span className="font-semibold text-red-800">
                    Your account is approved, but customer bookings and job dispatches remain locked until your Starter Kit purchase is completed.
                  </span>
                </div>
              </div>
              <button
                onClick={() => router.push("/provider/onboarding/kit")}
                className="shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
              >
                Pay & Activate Now →
              </button>
            </div>
          )}

          {showRechargeBanner && !showPaymentReminder && !pathname.includes("/provider/onboarding") && (
            <div className="bg-gradient-to-r from-amber-500 via-indigo-600 to-blue-700 text-white px-5 py-4 rounded-2xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-2xl">⚡</span>
                <div>
                  <span className="font-black block text-white text-base">Bookings Paused: Top Up or Subscribe</span>
                  <span className="font-medium text-amber-50 text-xs sm:text-sm">
                    Activate a subscription plan or top up your wallet to receive customer bookings.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => router.push(providerDetails?.kitPurchased === false ? "/provider/onboarding/kit" : "/provider/earnings")}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  💳 Top Up Wallet
                </button>
                <button
                  onClick={() => router.push("/provider/membership")}
                  className="flex-1 sm:flex-none px-4 py-2 bg-amber-400 text-slate-950 hover:bg-amber-300 font-extrabold text-xs rounded-xl transition-colors shadow-sm"
                >
                  ⭐ Take Subscription
                </button>
              </div>
            </div>
          )}

          <div className="w-full">{children}</div>
        </main>
      </div>

      {/* Recharge or Take Subscription Popup Modal */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative flex flex-col gap-6">
            <button
              onClick={() => {
                setShowRechargeModal(false);
                sessionStorage.setItem("recharge_modal_dismissed", "true");
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
                <Sparkles size={28} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                  Account Action Required
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Top Up or Subscribe</h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Your provider account currently does not have an active <strong className="text-slate-900">Free Trial / Subscription</strong> or sufficient <strong className="text-slate-900">Wallet Recharge</strong>. 
              Top up your wallet or subscribe to a plan to start receiving customer bookings and job dispatches immediately.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  sessionStorage.setItem("recharge_modal_dismissed", "true");
                  router.push(providerDetails?.kitPurchased === false ? "/provider/onboarding/kit" : "/provider/earnings");
                }}
                className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                Top Up Wallet
              </button>

              <button
                onClick={() => {
                  setShowRechargeModal(false);
                  sessionStorage.setItem("recharge_modal_dismissed", "true");
                  router.push("/provider/membership");
                }}
                className="flex-1 px-5 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Take Subscription
              </button>
            </div>

            <button
              onClick={() => {
                setShowRechargeModal(false);
                sessionStorage.setItem("recharge_modal_dismissed", "true");
              }}
              className="text-xs text-center text-slate-400 hover:text-slate-600 font-semibold transition-colors pt-1"
            >
              Remind Me Later
            </button>
          </div>
        </div>
      )}

      <ProviderProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
