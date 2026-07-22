"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import ProviderProfileModal from "./modals/ProviderProfileModal";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/utils/authFetch";
import { API_URL } from "@/config/api";

interface ProviderLayoutProps {
  children: React.ReactNode;
}

export default function ProviderLayout({ children }: ProviderLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingProviderStatus, setCheckingProviderStatus] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const { user, isLoading: isAuthLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthLoading) return;

    if (!isAuthenticated || user?.role !== "provider") {
      window.location.href = "/login";
      return;
    }

    const checkProviderKyc = async () => {
      const isExempt =
        pathname.includes("/provider/pending") ||
        pathname.includes("/provider/onboarding");

      if (!isExempt) {
        try {
          const response = await authFetch(`${API_URL}/providers/me`);
          if (response.ok) {
            const data = await response.json();
            if (data.kyc_status !== "verified") {
              router.push("/provider/pending");
              return;
            } else if (!data.kitPurchased) {
              setShowPaymentReminder(true);
            } else {
              setShowPaymentReminder(false);
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

        <main className="flex-1 px-4 lg:px-8 py-8 w-full mt-16">
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
          <div className="w-full">{children}</div>
        </main>
      </div>

      <ProviderProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
