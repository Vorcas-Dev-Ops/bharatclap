"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Package,
  Wallet,
  Star,
  MapPin,
  Image as ImageIcon,
  Wrench,
  LogOut,
  X,
  ChevronRight,
  Settings,
  Crown
} from "lucide-react";
import { motion } from "framer-motion";
import Cookies from "js-cookie";
import { useSettings } from "@/context/SettingsContext";

const menuItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/provider/dashboard" },
  { name: "Services", icon: Wrench, href: "/provider/services" },
  { name: "Bookings", icon: Package, href: "/provider/bookings" },
  { name: "Earnings", icon: Wallet, href: "/provider/earnings" },
  { name: "Operating Location", icon: MapPin, href: "/provider/area" },
  { name: "Reviews", icon: Star, href: "/provider/reviews" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const { platformName, platformLogo } = useSettings();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const getInitials = (name: string) => {
    if (!name) return "PR";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity lg:hidden ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-white/5 transition-transform duration-500 lg:translate-x-0 flex flex-col h-screen overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Branding Header - Aligned to TopNavbar height */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 relative overflow-hidden group shrink-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
          <Link href="/provider/dashboard" className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:rotate-6 transition-transform overflow-hidden">
              {platformLogo ? (
                <img src={platformLogo} alt={platformName} className="w-full h-full object-contain" />
              ) : (
                <span className="text-white font-black text-lg">{platformName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight leading-none">{platformName}</span>
            </div>
          </Link>
          <button
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Navigation - Adjusted vertical padding */}
        <div className="flex-1 px-3 py-3 flex flex-col overflow-y-auto custom-scrollbar">
          <nav className="space-y-1">
            {menuItems.map((link) => {
              const isActive =
                pathname === link.href ||
                (pathname.startsWith(link.href) && link.href !== '/provider/dashboard');
              const Icon = link.icon;

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                >
                  {/* Active Indicator Line */}
                  {isActive && (
                    <motion.div
                      layoutId="provider-active-indicator"
                      className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-400 rounded-r-full"
                    />
                  )}

                  <div className="flex items-center gap-3 relative z-10">
                    <div className={`transition-all duration-300 ${isActive ? 'text-white' : 'group-hover:text-blue-400 group-hover:scale-110'
                      }`}>
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    <span className={`text-[13px] font-bold tracking-tight transition-transform duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'
                      }`}>
                      {link.name}
                    </span>
                  </div>
                  {isActive && <ChevronRight size={12} className="opacity-60 relative z-10" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Profile Section - Fits without cutoff */}
        <div className="p-3 border-t border-white/5 bg-white/[0.01] shrink-0">
          <Link
            href="/provider/settings"
            className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer group mb-2"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner text-xs shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.name || "Provider"}</p>
              <p className="text-[9px] text-gray-500 font-bold truncate">{user?.email || "expert@bharatclap.com"}</p>
            </div>
            <Settings size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors shrink-0" />
          </Link>

          <button
            onClick={async () => {
              try {
                const token = localStorage.getItem("token");
                if (token) {
                  await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"}/providers/availability`, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ status: 'offline' })
                  });
                }
              } catch (e) {
                console.error('Failed to set offline status', e);
              }
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              Cookies.remove("token");
              Cookies.remove("userRole");
              window.location.href = "/login";
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest cursor-pointer"
          >
            <LogOut size={14} className="shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}