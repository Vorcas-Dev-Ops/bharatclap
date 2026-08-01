"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  List,
  Ticket,
  Calendar,
  CreditCard,
  RefreshCcw,
  Star,
  Gift,
  HelpCircle,
  Info,
  Settings,
  X,
  LogOut,
  ChevronRight,
  User,
  ShoppingCart,
  Bell,
  Bookmark
} from 'lucide-react';
import { motion } from 'framer-motion';
import Cookies from 'js-cookie';
import { useSettings } from '@/context/SettingsContext';

const sidebarLinks = [
  { icon: Briefcase, label: "Services", href: "/home" },
  { icon: List, label: "Categories", href: "/categories" },
  { icon: ShoppingCart, label: "My Cart", href: "/user/cart" },
  { icon: Calendar, label: "My Bookings", href: "/user/bookings" },
  { icon: Ticket, label: "Offers", href: "/offers" },
  { icon: Bell, label: "Notifications", href: "/user/notifications" },
  { icon: Bookmark, label: "Saved Services", href: "/user/saved" },
  { icon: RefreshCcw, label: "Refunds & Cancellations", href: "/user/refunds" },
  { icon: CreditCard, label: "Payments", href: "/user/billing" },
  { icon: Gift, label: "Refer & Earn", href: "/user/refer" },
  { icon: HelpCircle, label: "Help & Support", href: "/user/support" },
  { icon: Info, label: "About", href: "/user/about" },
  { icon: Settings, label: "Settings", href: "/user/settings" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomerSidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const { platformName, platformLogo } = useSettings();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) { }
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Cookies.remove('token');
    Cookies.remove('userRole');
    window.location.href = '/login';
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-white/5 transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex-shrink-0 flex flex-col h-screen overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* Branding Header */}
      <div className="flex items-center justify-between h-20 px-6 relative overflow-hidden group shrink-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
        <Link href="/home" className="flex items-center gap-3 relative z-10">
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

      {/* Main Navigation */}
      <div className="flex-1 px-3 py-4 flex flex-col overflow-y-auto custom-scrollbar">
        <nav className="space-y-1">
          {sidebarLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (pathname.startsWith(link.href) && link.href !== '/home' && link.href !== '/');
            const Icon = link.icon;

            return (
              <Link
                key={link.label}
                href={link.href}
                className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
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
                    {link.label}
                  </span>
                </div>
                {isActive && <ChevronRight size={12} className="opacity-60 relative z-10" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Section */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01] shrink-0">
        <Link href="/user/profile" className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer group mb-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner text-xs uppercase">
            {user?.name ? user.name.charAt(0) : <User size={14} />}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{user?.name || "Customer"}</p>
            <p className="text-[9px] text-gray-500 font-bold truncate">{user?.email || "Manage Profile"}</p>
          </div>
          <Settings size={14} className="text-gray-500 group-hover:text-blue-400 transition-colors" />
        </Link>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
        >
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default CustomerSidebar;
