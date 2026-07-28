"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarCheck,
  List,
  Layers,
  LayoutGrid,
  MapPin,
  Image as ImageIcon,
  BarChart2,
  X,
  ChevronRight,
  ChevronDown,
  LogOut,
  Settings,
  Ticket,
  Crown,
  PieChart,
  Activity,
  CreditCard,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Cookies from 'js-cookie';
import { useSettings } from '@/context/SettingsContext';
import axios from 'axios';
import { API_URL } from '@/config/api';

type SubMenuItem = {
  name: string;
  href: string;
};

type SidebarItem = {
  name: string;
  href?: string;
  icon: any;
  subItems?: SubMenuItem[];
};

const sidebarLinks: SidebarItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  {
    name: 'Subscriptions & Wallet',
    icon: Gift,
    subItems: [
      { name: 'Lead Packages', href: '/admin/packages' },
      { name: 'Dispatch & Load Balancing', href: '/admin/settings/dispatch' },
      { name: 'Category Capacity Rules', href: '/admin/settings/categories' },
      { name: 'Provider Subscriptions', href: '/admin/providers/subscriptions' },
      { name: 'Wallet & Subscription Center', href: '/admin/wallet-center' },
      { name: 'Subscription Policies', href: '/admin/settings/policies' },
    ]
  },
  {
    name: 'Management',
    icon: Users,
    subItems: [
      { name: 'Users', href: '/admin/users' },
      { name: 'Providers', href: '/admin/providers' },
      { name: 'Live Tracking', href: '/admin/live-tracking' },
      { name: 'Bookings', href: '/admin/bookings' },
      { name: 'Services', href: '/admin/services' },
      { name: 'Locations', href: '/admin/locations' },
      { name: 'Accessories', href: '/admin/accessories' },
      { name: 'Timeslot Rules', href: '/admin/timeslot' },
    ]
  },
  {
    name: 'Marketing',
    icon: Ticket,
    subItems: [
      { name: 'Offers & Coupons', href: '/admin/offers' },
      { name: 'Banners', href: '/admin/banners' },
      { name: 'Memberships', href: '/admin/memberships' },
    ]
  },
  {
    name: 'Finance',
    icon: CreditCard,
    subItems: [
      { name: 'Payments', href: '/admin/payments' },
      { name: 'Settlements', href: '/admin/settlements' },
      { name: 'Refunds', href: '/admin/refunds' },
      { name: 'Refund Policy', href: '/admin/refund-policy' },
      { name: 'Payouts', href: '/admin/payouts' },
      { name: 'Commissions', href: '/admin/commissions' },
      { name: 'Provider Starter Kit', href: '/admin/starter-kit' },
    ]
  },
  {
    name: 'Analytics',
    icon: BarChart2,
    subItems: [
      { name: 'Reports', href: '/admin/reports' },
      { name: 'Revenue Analytics', href: '/admin/analytics/revenue' },
      { name: 'Provider Response Analytics', href: '/admin/provider-response-analytics' },
      { name: 'Provider Analytics', href: '/admin/analytics/provider' },
      { name: 'Provider Performance', href: '/admin/analytics/provider-performance' },
    ]
  }
];

const PERMISSIONS = {
  super_admin: {
    dashboard: 'edit',
    users: 'edit',
    providers: 'edit',
    bookings: 'edit',
    services: 'edit',
    locations: 'edit',
    accessories: 'edit',
    offers: 'edit',
    banners: 'edit',
    memberships: 'edit',
    payments: 'edit',
    refunds: 'edit',
    payouts: 'edit',
    commissions: 'edit',
    starterKit: 'edit',
    reports: 'edit',
    settings: 'edit',
  },
  operations_admin: {
    dashboard: 'edit',
    users: 'none',
    providers: 'edit',
    bookings: 'edit',
    services: 'edit',
    locations: 'edit',
    accessories: 'edit',
    offers: 'edit',
    banners: 'edit',
    memberships: 'edit',
    payments: 'view',
    refunds: 'view',
    payouts: 'view',
    commissions: 'view',
    starterKit: 'view',
    reports: 'view',
    settings: 'none',
  },
  finance_admin: {
    dashboard: 'view',
    users: 'none',
    providers: 'none',
    bookings: 'view',
    services: 'none',
    locations: 'none',
    accessories: 'none',
    offers: 'none',
    banners: 'none',
    memberships: 'none',
    payments: 'edit',
    refunds: 'edit',
    payouts: 'edit',
    commissions: 'edit',
    starterKit: 'edit',
    reports: 'view',
    settings: 'none',
  },
  support_admin: {
    dashboard: 'view',
    users: 'view',
    providers: 'view',
    bookings: 'view',
    services: 'view',
    locations: 'view',
    accessories: 'view',
    offers: 'view',
    banners: 'view',
    memberships: 'view',
    payments: 'view',
    refunds: 'view',
    payouts: 'view',
    commissions: 'view',
    starterKit: 'view',
    reports: 'view',
    settings: 'none',
  }
};

const getPermissionKey = (name: string): string => {
  switch (name) {
    case 'Dashboard': return 'dashboard';
    case 'Users': return 'users';
    case 'Providers': return 'providers';
    case 'Live Tracking': return 'providers';
    case 'Bookings': return 'bookings';
    case 'Services': return 'services';
    case 'Locations': return 'locations';
    case 'Accessories': return 'accessories';
    case 'Timeslot Rules': return 'services';
    case 'Lead Packages': return 'providers';
    case 'Dispatch & Load Balancing': return 'providers';
    case 'Category Capacity Rules': return 'services';
    case 'Provider Subscriptions': return 'providers';
    case 'Wallet & Subscription Center': return 'payments';
    case 'Subscription Policies': return 'settings';
    case 'Offers & Coupons': return 'offers';
    case 'Banners': return 'banners';
    case 'Memberships': return 'memberships';
    case 'Wallet Center': return 'payments';
    case 'Payments': return 'payments';
    case 'Refunds': return 'refunds';
    case 'Refund Policy': return 'refunds';
    case 'Payouts': return 'payouts';
    case 'Commissions': return 'commissions';
    case 'Provider Starter Kit': return 'starterKit';
    case 'Reports': return 'reports';
    case 'Revenue Analytics': return 'reports';
    case 'Provider Analytics': return 'reports';
    case 'Provider Performance': return 'reports';
    default: return 'dashboard';
  }
};

import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const { platformName, platformLogo } = useSettings();
  const { user: adminUser, logout } = useAuth();
  
  const rawRole = adminUser?.admin_role?.toLowerCase();
  const roleKey = (rawRole && PERMISSIONS[rawRole as keyof typeof PERMISSIONS]) ? (rawRole as keyof typeof PERMISSIONS) : 'super_admin';
  const adminRole: keyof typeof PERMISSIONS = roleKey;

  useEffect(() => {
    sidebarLinks.forEach(link => {
      if (link.subItems) {
        const isActive = link.subItems.some(sub => pathname === sub.href || pathname.startsWith(sub.href));
        if (isActive) {
          setOpenMenu(link.name);
        }
      }
    });
  }, [pathname]);

  const toggleMenu = (name: string) => {
    setOpenMenu(prev => prev === name ? null : name);
  };

  const handleSignOut = async () => {
    await logout();
  };

  const filteredLinks = sidebarLinks.map(link => {
    if (link.subItems) {
      const allowedSubItems = link.subItems.filter(sub => {
        const key = getPermissionKey(sub.name);
        const perm = PERMISSIONS[adminRole]?.[key as keyof typeof PERMISSIONS['super_admin']] || 'none';
        return perm !== 'none';
      });
      if (allowedSubItems.length === 0) return null;
      return { ...link, subItems: allowedSubItems };
    } else {
      const key = getPermissionKey(link.name);
      const perm = PERMISSIONS[adminRole]?.[key as keyof typeof PERMISSIONS['super_admin']] || 'none';
      if (perm === 'none') return null;
      return link;
    }
  }).filter(Boolean) as SidebarItem[];

  const hasSettingsAccess = PERMISSIONS[adminRole]?.settings !== 'none';

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-white/5 transition-transform duration-500 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex-shrink-0 flex flex-col h-screen overflow-hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      {/* Branding Header */}
      <div className="flex items-center justify-between h-20 px-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
        <Link href="/admin/dashboard" className="flex items-center gap-3 relative z-10">
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
      <div className="flex-1 px-3 py-4 flex flex-col overflow-y-auto dark-scrollbar">
        <nav className="space-y-2">
          {filteredLinks.map((link) => {
            const hasSubItems = !!link.subItems;
            const isActive = !hasSubItems 
              ? (pathname === link.href || (pathname.startsWith(link.href!) && link.href !== '/admin/dashboard'))
              : link.subItems!.some(sub => pathname === sub.href || pathname.startsWith(sub.href));

            const isOpenMenu = openMenu === link.name;
            const Icon = link.icon;

            const content = (
              <>
                {isActive && !hasSubItems && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-400 rounded-r-full"
                  />
                )}
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`transition-all duration-300 ${isActive ? 'text-white' : 'group-hover:text-blue-400 group-hover:scale-110'}`}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[13px] font-bold tracking-tight transition-transform duration-300 ${isActive && !hasSubItems ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                    {link.name}
                  </span>
                </div>
                {hasSubItems ? (
                  isOpenMenu ? <ChevronDown size={12} className="opacity-60 relative z-10" /> : <ChevronRight size={12} className="opacity-60 relative z-10" />
                ) : (
                  isActive && <ChevronRight size={12} className="opacity-60 relative z-10" />
                )}
              </>
            );

            return (
              <div key={link.name} className="flex flex-col">
                {hasSubItems ? (
                  <button
                    onClick={() => toggleMenu(link.name)}
                    className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                      isActive && !isOpenMenu
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    href={link.href!}
                    className={`flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {content}
                  </Link>
                )}
                
                <AnimatePresence>
                  {hasSubItems && isOpenMenu && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 mb-2 ml-4 pl-3 border-l border-white/10 space-y-2 flex flex-col">
                        {link.subItems!.map((sub) => {
                          const isSubActive = pathname === sub.href || pathname.startsWith(sub.href);
                          return (
                            <Link
                              key={sub.name}
                              href={sub.href}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative overflow-hidden ${
                                isSubActive
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <span className={`text-[12px] font-bold tracking-tight transition-transform duration-300 ${isSubActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                {sub.name}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Section */}
      <div className="p-4 border-t border-white/5 bg-white/[0.01] relative">
        <AnimatePresence>
          {isSettingsMenuOpen && hasSettingsAccess && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-2 bg-[#1E293B] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="flex flex-col py-2">
                <Link 
                  href="/admin/settings" 
                  onClick={() => setIsSettingsMenuOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Platform Settings
                </Link>
                <Link 
                  href="/admin/refund-policy" 
                  onClick={() => setIsSettingsMenuOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Refund Policy
                </Link>
                <Link 
                  href="/admin/timeslot" 
                  onClick={() => setIsSettingsMenuOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Timeslot
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {hasSettingsAccess ? (
          <button 
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all cursor-pointer group mb-3 ${isSettingsMenuOpen ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-inner text-xs">
                {adminUser?.name ? adminUser.name.slice(0,2).toUpperCase() : 'AD'}
              </div>
              <div className="flex flex-col text-left overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{adminUser?.name || 'Administrator'}</p>
                <p className="text-[9px] text-gray-500 font-bold truncate">
                  {adminUser?.admin_role ? adminUser.admin_role.replace('_', ' ').toUpperCase() : 'SUPER ADMIN'}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 pr-1">
              <Settings size={18} className={`transition-all duration-300 ${isSettingsMenuOpen ? 'text-blue-400 rotate-90' : 'text-gray-500 group-hover:text-blue-400 group-hover:rotate-45'}`} />
            </div>
          </button>
        ) : (
          <div 
            className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-white/5 mb-3"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-blue-600 flex-shrink-0 flex items-center justify-center font-bold text-white shadow-inner text-xs">
              {adminUser?.name ? adminUser.name.slice(0,2).toUpperCase() : 'AD'}
            </div>
            <div className="flex flex-col text-left overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{adminUser?.name || 'Administrator'}</p>
              <p className="text-[9px] text-gray-500 font-bold truncate">
                {adminUser?.admin_role ? adminUser.admin_role.replace('_', ' ').toUpperCase() : 'SUPER ADMIN'}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all text-[10px] font-bold uppercase tracking-widest"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
