"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import ProviderProfileModal from "./modals/ProviderProfileModal";

import Cookies from "js-cookie";

interface ProviderLayoutProps {
  children: React.ReactNode;
}

  export default function ProviderLayout({ children }: ProviderLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [showPaymentReminder, setShowPaymentReminder] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const clearAuthAndRedirect = () => {
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("jwt");
        localStorage.removeItem("user");
        sessionStorage.removeItem("onboarding_skipped_session");
      } catch (e) {}
      Cookies.remove("token");
      Cookies.remove("userRole");
      window.location.href = "/login";
    };

    const checkAuth = async () => {
      const token =
        localStorage.getItem("token") || localStorage.getItem("jwt");
      const userStr = localStorage.getItem("user");

      if (
        !token ||
        token === "undefined" ||
        token === "null" ||
        !userStr ||
        userStr === "undefined" ||
        userStr === "null"
      ) {
        clearAuthAndRedirect();
        return;
      }

      try {
        const user = JSON.parse(userStr);
        if (!user) {
          clearAuthAndRedirect();
          return;
        }

        const role = user.role || (user.user && user.user.role);

        if (role !== "provider") {
          clearAuthAndRedirect();
          return;
        }

        // Exempt routes from onboarding check
        const isExempt =
          pathname.includes("/provider/pending") ||
          pathname.includes("/provider/onboarding");

        if (!isExempt) {
          try {
            const API_URL =
              process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
            const response = await fetch(`${API_URL}/providers/me`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

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
            } else {
              // Failed to fetch provider profile, maybe doesn't exist yet
              if (response.status === 404 || response.status === 401) {
                // Ignore for now or handle appropriately
              }
            }
          } catch (err) {
            console.error("Error fetching provider status:", err);
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        clearAuthAndRedirect();
      }
    };

    checkAuth();

    // URL Trigger check
    if (window.location.search.includes("edit=profile")) {
      setProfileModalOpen(true);
      // Clean up URL without reload
      window.history.replaceState({}, "", pathname);
    }

    const handleOpenProfile = () => setProfileModalOpen(true);
    window.addEventListener("openProviderProfile", handleOpenProfile);
    return () =>
      window.removeEventListener("openProviderProfile", handleOpenProfile);
  }, [router, pathname]);

  if (isLoading) {
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
