"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  User,
  ShoppingCart,
  Briefcase,
  LogOut,
  Settings,
  Calendar,
  Bell,
  Heart,
  CreditCard,
  Gift,
  Star,
  HelpCircle,
  Info,
  RefreshCcw,
  List,
  Ticket,
  Home,
  Phone,
} from "lucide-react";
import AddressFormModal from "../user/profile/AddressFormModal";
import AddressDropdown from "./AddressDropdown";
import ProfileModal from "../user/profile/ProfileModal";
import AddressModal from "../user/profile/AddressModal";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import Cookies from 'js-cookie';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from "@/config/api";
import { connectSocket } from "@/services/socket";

const Navbar = () => {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const [locationObj, setLocationObj] = useState<{ title: string; subtitle: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { platformName, platformLogo } = useSettings();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpenState, setIsProfileModalOpenState] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { itemCount } = useCart();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiClient.get('/notifications');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      const unread = data.filter((n: any) => !n.is_read).length;
      setUnreadNotificationCount(unread);
    } catch (err) {
      console.warn("Failed to fetch unread notification count", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && user?._id) {
      fetchUnreadCount();

      const socket = connectSocket(user._id, 'user');
      const handleSocketUpdate = () => {
        fetchUnreadCount();
      };

      socket.on('booking_status_update', handleSocketUpdate);
      socket.on('user_notification', handleSocketUpdate);

      return () => {
        socket.off('booking_status_update', handleSocketUpdate);
        socket.off('user_notification', handleSocketUpdate);
      };
    } else {
      setUnreadNotificationCount(0);
    }
  }, [isLoggedIn, user]);

  const syncDefaultAddress = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const { apiClient } = await import("@/config/api");
      const res = await apiClient.get('/addresses');
      const addresses = res.data;
      if (!Array.isArray(addresses) || addresses.length === 0) {
        setLocationObj(null);
        localStorage.removeItem("userLocationObj");
        localStorage.removeItem("userLocationId");
        localStorage.removeItem("userLocation");
        return;
      }

      // Priority 1: User's selected address for this session
      const selectedId = localStorage.getItem("userLocationId");
      let targetAddr = null;
      if (selectedId) {
        targetAddr = addresses.find((a: any) => a._id === selectedId);
      }

      // Priority 2: User's default address
      if (!targetAddr) {
        targetAddr = addresses.find((a: any) => a.is_default) || addresses[0];
      }

      if (!targetAddr) return;

      const typeLabel =
        targetAddr.address_type === "Other" && targetAddr.label
          ? targetAddr.label
          : targetAddr.address_type || "Address";
      const areaLabel = [targetAddr.area_locality, targetAddr.city]
        .filter(Boolean)
        .join(", ");
        
      const newLocObj = { title: typeLabel, subtitle: areaLabel };
      setLocationObj(newLocObj);
      localStorage.setItem("userLocationObj", JSON.stringify(newLocObj));
      localStorage.setItem("userLocationId", targetAddr._id);
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Address sync deferred:", err?.message || err);
      }
    }
  };

  const { user: authUser, isAuthenticated: authIsLoggedIn, logout: authLogout } = useAuth();

  useEffect(() => {
    setMounted(true);

    const loadUser = () => {
      if (authIsLoggedIn && authUser) {
        setIsLoggedIn(true);
        setUser(authUser as any);
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    loadUser();
    const savedLocationObjStr = localStorage.getItem("userLocationObj");
    if (savedLocationObjStr) {
      try {
        setLocationObj(JSON.parse(savedLocationObjStr));
      } catch {
        setLocationObj(null);
      }
    } else {
      setLocationObj(null);
    }
    
    if (authIsLoggedIn) {
      syncDefaultAddress();
    }

    const handleAuthLogin = () => {
      loadUser();
      setTimeout(async () => {
        await syncDefaultAddress();
        if (!localStorage.getItem("userLocation")) {
          setIsAddressDropdownOpen(true);
        }
      }, 100);
    };

    window.addEventListener("storage", loadUser);
    window.addEventListener("auth-login", handleAuthLogin);
    window.addEventListener("addressChanged", syncDefaultAddress);
    window.addEventListener("defaultAddressChanged", syncDefaultAddress);

    const handleLocationStorage = (e: StorageEvent) => {
      if (e.key === "userLocationObj") {
        try {
          setLocationObj(JSON.parse(e.newValue || "null"));
        } catch {
          setLocationObj(null);
        }
      }
    };
    window.addEventListener("storage", handleLocationStorage);

    return () => {
      window.removeEventListener("storage", loadUser);
      window.removeEventListener("auth-login", handleAuthLogin);
      window.removeEventListener("addressChanged", syncDefaultAddress);
      window.removeEventListener("defaultAddressChanged", syncDefaultAddress);
      window.removeEventListener("storage", handleLocationStorage);
    };
  }, [authIsLoggedIn, authUser]);

  const handleLogout = async () => {
    localStorage.removeItem("userLocation");
    localStorage.removeItem("userLocationId");
    await authLogout();
  };

  const pathname = usePathname();

  // Auto-close drawer on navigation
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = isDrawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isDrawerOpen]);

  const handleLocationSelect = (newLocation: string, id: string) => {
    localStorage.setItem("userLocationId", id);
    setIsLocationModalOpen(false);
    setIsAddressDropdownOpen(false);
    window.dispatchEvent(new Event("addressChanged"));
  };

  // ─── Drawer menu structure ───────────────────────────────────────────
  const mainNavItems = [
    { icon: Home, label: "Home", href: "/" },
    ...(user?.role === "admin" || user?.role === "super_admin"
      ? [{ icon: Briefcase, label: "Admin Dashboard", href: "/admin/dashboard" }]
      : []
    ),
    ...(user?.role === "provider"
      ? [{ icon: Briefcase, label: "Provider Dashboard", href: "/provider/dashboard" }]
      : []
    ),
    { icon: List, label: "Categories", href: "/categories" },
    { icon: ShoppingCart, label: "Cart", href: "/user/cart", badge: itemCount > 0 ? itemCount : undefined },
    { icon: Calendar, label: "My Bookings", href: "/user/bookings" },
    { icon: RefreshCcw, label: "Refunds & Cancellations", href: "/user/refunds" },
    { icon: CreditCard, label: "Payments", href: "/user/billing" },
  ];

  const moreNavItems = [
    { icon: Ticket, label: "Offers & Coupons", href: "/user/offers" },
    { icon: MapPin, label: "Saved Addresses", href: "#addresses", action: () => setIsAddressModalOpen(true) },
  ];

  const supportItems = [
    { icon: HelpCircle, label: "Help & Support", href: "/user/support" },
    { icon: Info, label: `About ${platformName}`, href: "/about" },
    { icon: Settings, label: "Settings", href: "/user/settings" },
    { icon: Phone, label: "Contact Us", href: "/contact" },
  ];

  const profileMenuItems = [
    ...(user?.role === "admin" || user?.role === "super_admin"
      ? [{ icon: Briefcase, label: "Admin Dashboard", href: "/admin/dashboard" }]
      : []
    ),
    ...(user?.role === "provider"
      ? [{ icon: Briefcase, label: "Provider Dashboard", href: "/provider/dashboard" }]
      : []
    ),
    { icon: User, label: "My Profile", action: () => { setIsProfileModalOpenState(true); setIsProfileOpen(false); } },
    { icon: MapPin, label: "Saved Addresses", action: () => { setIsAddressModalOpen(true); setIsProfileOpen(false); } },
  ];

  const DrawerLink = ({ item }: { item: any }) => {
    const isActive = pathname === item.href;
    const Icon = item.icon;
    const inner = (
      <span
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative cursor-pointer
          ${isActive
            ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
            : "text-gray-400 hover:bg-white/5 hover:text-white"
          }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/4 bottom-1/4 w-[3px] bg-blue-400 rounded-r-full" />
        )}
        <span className={`transition-all duration-200 ${isActive ? "text-blue-400" : "group-hover:text-blue-400 group-hover:scale-110"}`}>
          <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        </span>
        <span className={`text-[13px] font-bold tracking-tight flex-1 ${isActive ? "text-blue-300" : ""}`}>
          {item.label}
        </span>
        {item.badge !== undefined && (
          <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {item.badge}
          </span>
        )}
        {isActive && <ChevronRight size={12} className="opacity-50" />}
      </span>
    );

    if (item.action) {
      return (
        <button className="w-full text-left" onClick={() => { item.action(); setIsDrawerOpen(false); }}>
          {inner}
        </button>
      );
    }
    return (
      <Link href={item.href} onClick={() => setIsDrawerOpen(false)}>
        {inner}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 px-4 pt-5 pb-1">{label}</p>
  );

  return (
    <>
      <nav className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md transition-all duration-500">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">

          {/* Left Side: Hamburger & Brand */}
          <div className="flex items-center gap-4 sm:gap-6 flex-1">
            {isLoggedIn && (
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6 text-slate-700" />
              </button>
            )}

            <Link href="/" className="flex items-center gap-2">
              {platformLogo ? (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                  <img src={platformLogo} alt={platformName} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                  <span className="text-sm font-black text-white">{platformName.substring(0, 2).toUpperCase()}</span>
                </div>
              )}
              <span className="text-xl font-black text-[#1D2B83] tracking-tighter">{platformName}</span>
            </Link>

            {isLoggedIn && (
              <>
                <div className="h-6 w-px bg-slate-200 hidden md:block" />
                <button
                  ref={locationBtnRef}
                  onClick={() => setIsAddressDropdownOpen((prev) => !prev)}
                  className="hidden md:flex items-center gap-2 group px-3 py-1.5 hover:bg-slate-50 rounded-xl transition-all text-left"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="flex flex-col max-w-[160px]">
                      <span className="text-sm font-bold text-slate-800 leading-tight truncate">
                        {locationObj ? locationObj.title : "Select Location"}
                      </span>
                      {locationObj?.subtitle && (
                        <span className="text-[11px] font-medium text-slate-500 leading-tight truncate">
                          {locationObj.subtitle}
                        </span>
                      )}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 mt-0.5 transition-transform ${isAddressDropdownOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                  </div>
                </button>
              </>
            )}
          </div>

          {/* Center: Welcome Message */}
          {isLoggedIn && (
            <div className="hidden lg:flex items-center justify-center flex-1">
              <div className="flex flex-col items-center leading-tight">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Welcome back</span>
                <span className="text-sm font-black text-[#1D2B83]">{user?.name || "User"}</span>
              </div>
            </div>
          )}

          {/* Right Side: User Actions */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 flex-1">
            {!mounted ? (
              <div className="w-20 h-8 bg-slate-100 animate-pulse rounded-lg" />
            ) : isLoggedIn ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Cart Icon */}
                <Link href="/user/cart">
                  <div className="p-2.5 hover:bg-slate-100 rounded-xl transition-all group relative">
                    <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-[#1D2B83]" />
                    {itemCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-300">
                        {itemCount}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Notification Bell Icon */}
                <Link href="/user/notifications">
                  <div className="p-2.5 hover:bg-slate-100 rounded-xl transition-all group relative">
                    <Bell className="w-5 h-5 text-slate-600 group-hover:text-[#1D2B83]" />
                    {unreadNotificationCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-300">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className={`w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group overflow-hidden ${isProfileOpen ? 'ring-2 ring-blue-100' : ''}`}
                  >
                    {user?.profile_image && user.profile_image !== "" ? (
                      <img src={user.profile_image} alt={user.name || "Profile"} className="w-full h-full object-cover" />
                    ) : user?.name || user?.email ? (
                      <span className="text-xs font-black text-[#1D2B83]">
                        {(user.name || user.email || "U").split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                    ) : (
                      <User className="w-5 h-5 text-[#1D2B83]" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isProfileOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          onClick={() => setIsProfileOpen(false)}
                          className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50 p-2"
                        >
                          <div className="p-3 mb-2 border-b border-slate-50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-600 overflow-hidden flex items-center justify-center font-bold text-white text-xs uppercase shadow-inner">
                              {user?.profile_image && user.profile_image !== "" ? (
                                <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (user?.name || user?.email || "U").split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                              )}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-800 truncate">{user?.name || "User"}</p>
                              <p className="text-[10px] text-slate-400 font-bold truncate">{user?.email || "Account details"}</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            {profileMenuItems.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  setIsProfileOpen(false);
                                  if (item.action) item.action();
                                  else if ((item as any).href) window.location.href = (item as any).href;
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-[#1D2B83] transition-all group"
                              >
                                <item.icon className="w-4 h-4 text-slate-400 group-hover:text-[#1D2B83]" />
                                <span className="text-[13px] font-bold tracking-tight">{item.label}</span>
                              </button>
                            ))}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-50">
                            <button
                              onClick={() => { handleLogout(); setIsProfileOpen(false); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all text-[11px] font-bold uppercase tracking-widest"
                            >
                              <LogOut size={16} />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button type="text" className="font-bold text-slate-600 h-10 px-6">LOGIN</Button>
                </Link>
                <Link href="/signup">
                  <Button type="primary" className="bg-[#1D2B83] font-bold h-10 px-8 rounded-xl border-none shadow-lg shadow-blue-900/20">
                    SIGN UP
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ─── Full-Featured Hamburger Drawer ─────────────────────────────── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed top-0 left-0 bottom-0 w-[320px] sm:w-[360px] z-[70] bg-[#0D1526] shadow-2xl flex flex-col"
            >
              {/* ── Header: Logo + Close ── */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-white/5 shrink-0">
                <Link href="/" onClick={() => setIsDrawerOpen(false)} className="flex items-center gap-2.5">
                  {platformLogo ? (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                      <img src={platformLogo} alt={platformName} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20 overflow-hidden">
                      <span className="text-white font-black text-base">{platformName.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-base font-black text-white tracking-tight">{platformName}</span>
                </Link>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ── User Profile Card ── */}
              <div className="px-4 py-4 border-b border-white/5 shrink-0">
                <button
                  onClick={() => { setIsProfileModalOpenState(true); setIsDrawerOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 overflow-hidden flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0">
                    {user?.profile_image && user.profile_image !== "" ? (
                      <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (user?.name || user?.email || "U").split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)
                    )}
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-black text-white truncate">{user?.name || "Guest User"}</p>
                    <p className="text-[11px] text-gray-400 font-semibold truncate">{user?.email || user?.phone || "Tap to view profile"}</p>
                    {locationObj && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <MapPin size={9} className="text-blue-400 flex-shrink-0" />
                        <span className="text-[10px] text-blue-400 font-semibold truncate">
                          {locationObj.title} {locationObj.subtitle ? `· ${locationObj.subtitle}` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
                </button>
              </div>

              {/* ── Scrollable Navigation ── */}
              <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>

                {/* Main Nav */}
                <SectionLabel label="Main Menu" />
                <nav className="px-3 space-y-0.5">
                  {mainNavItems.map((item) => <DrawerLink key={item.href} item={item} />)}
                </nav>

                {/* More */}
                <SectionLabel label="More" />
                <nav className="px-3 space-y-0.5">
                  {moreNavItems.map((item) => <DrawerLink key={item.label} item={item} />)}
                </nav>

                {/* Support */}
                <SectionLabel label="Support" />
                <nav className="px-3 space-y-0.5">
                  {supportItems.map((item) => <DrawerLink key={item.href} item={item} />)}
                </nav>

                <div className="h-4" />
              </div>

              {/* ── Sticky Logout ── */}
              <div className="shrink-0 px-4 py-4 border-t border-white/5 bg-[#0D1526]">
                <button
                  onClick={() => { handleLogout(); setIsDrawerOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all group border border-transparent hover:border-red-500/20"
                >
                  <div className="group-hover:scale-110 transition-transform">
                    <LogOut size={17} />
                  </div>
                  <span className="text-[13px] font-bold tracking-tight">Logout</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Address dropdown — shows saved addresses */}
      <AddressDropdown
        isOpen={isAddressDropdownOpen}
        anchorRef={locationBtnRef}
        onClose={() => setIsAddressDropdownOpen(false)}
        onSelectAddress={handleLocationSelect}
        onAddNew={() => {
          setIsAddressDropdownOpen(false);
          setIsLocationModalOpen(true);
        }}
      />
      {/* Address form modal directly opened when "Add new" is clicked */}
      <AddressFormModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSaved={(addr) => {
          if (addr && addr.city) {
            handleLocationSelect(addr.city, addr._id);
          }
        }}
      />
      <ProfileModal
        isOpen={isProfileModalOpenState}
        onClose={() => setIsProfileModalOpenState(false)}
        user={user}
        onUpdate={(updatedUser) => {
          setUser(updatedUser);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }}
      />
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
      />
      <div className="h-16" />
    </>
  );
};

export default Navbar;
