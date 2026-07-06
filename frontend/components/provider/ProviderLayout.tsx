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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const clearAuthAndRedirect = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("jwt");
      localStorage.removeItem("user");
      Cookies.remove("token");
      Cookies.remove("userRole");
      router.push("/login");
    };

    const checkAuth = () => {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      const userStr = localStorage.getItem("user");

      if (!token || token === "undefined" || token === "null" || !userStr || userStr === "undefined" || userStr === "null") {
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
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        clearAuthAndRedirect();
      }
    };

    checkAuth();

    // URL Trigger check
    if (window.location.search.includes('edit=profile')) {
      setProfileModalOpen(true);
      // Clean up URL without reload
      window.history.replaceState({}, '', pathname);
    }

    const handleOpenProfile = () => setProfileModalOpen(true);
    window.addEventListener('openProviderProfile', handleOpenProfile);
    return () => window.removeEventListener('openProviderProfile', handleOpenProfile);
  }, [router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]"></div>
          <p className="text-slate-500 font-medium animate-pulse">Verifying access...</p>
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
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

      <ProviderProfileModal 
        isOpen={profileModalOpen} 
        onClose={() => setProfileModalOpen(false)} 
      />
    </div>
  );
}
