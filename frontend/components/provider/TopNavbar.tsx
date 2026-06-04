"use client";

import React, { useState, useEffect } from "react";
import { Menu, Bell, User, ChevronDown, UserCircle, Settings, LogOut, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import axios from "axios";
import { API_URL } from "@/config/api";
import Cookies from "js-cookie";
import { getSocket } from "@/services/socket";

interface TopNavbarProps {
  onOpenSidebar: () => void;
}

export default function TopNavbar({ onOpenSidebar }: TopNavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [providerStatus, setProviderStatus] = useState<string>("offline");
  const [notifications, setNotifications] = useState<any[]>([]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        const res = await axios.get(`${API_URL}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotifications(res.data);
      }
    } catch (error) {
      console.error("Error fetching notifications", error);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("token");
        const storedUser = localStorage.getItem("user");
        
        if (storedUser) setUser(JSON.parse(storedUser));

        if (token && token !== "pending_auth_token") {
          const response = await axios.get(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    const fetchProviderStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const response = await axios.get(`${API_URL}/providers/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setProviderStatus(response.data.availability_status || "offline");
        }
      } catch (error) {
        console.error("Error fetching provider status:", error);
      }
    };

    fetchUserData();
    fetchProviderStatus();
    fetchNotifications();

    const handleStatusChange = (e: any) => {
      setProviderStatus(e.detail);
    };

    window.addEventListener('providerStatusChanged', handleStatusChange);
    
    // Socket listener for new notifications (booking assigned)
    const socket = getSocket();
    const handleNewBooking = () => {
      fetchNotifications();
    };
    
    socket.on('booking_assigned', handleNewBooking);

    return () => {
      window.removeEventListener('providerStatusChanged', handleStatusChange);
      socket.off('booking_assigned', handleNewBooking);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    Cookies.remove("token");
    Cookies.remove("userRole");
    window.location.href = "/login";
  };

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-64 h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md z-30 px-4 lg:px-8 transition-all">
      <div className="h-full flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onOpenSidebar}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Notifications */}
          <div className="relative">
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2.5 text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-rose-500 border-2 border-white rounded-full"></span>
              )}
            </button>

            {isNotifOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)} />
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[400px] flex flex-col">
                  <div className="px-4 py-3 border-b border-slate-50 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full">{unreadCount} New</span>
                    )}
                  </div>
                  <div className="overflow-y-auto">
                    {notifications.length > 0 ? notifications.map((notif: any) => (
                      <div 
                        key={notif._id} 
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif._id);
                          if (notif.type === 'booking_alert') window.location.href = '/provider/bookings';
                        }}
                        className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-50'}`}
                      >
                        <p className="text-sm font-bold text-slate-800 mb-1 flex justify-between">
                          {notif.title}
                          {!notif.is_read && <span className="h-2 w-2 bg-primary rounded-full mt-1"></span>}
                        </p>
                        <p className="text-xs text-slate-500 leading-relaxed">{notif.message}</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                    )) : (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="hidden lg:block text-right">
                <span className="block text-sm font-bold text-slate-900">{user?.name || "Provider"}</span>
                <span className={`block text-xs font-medium ${providerStatus === 'available' ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {providerStatus === 'available' ? '• Online' : '• Offline'}
                </span>
              </div>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-50 transition-all border border-slate-100"
              >
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                  <img 
                    src={user?.profile_image ? (
                      user.profile_image.startsWith('http') || user.profile_image.startsWith('data:') 
                        ? user.profile_image 
                        : `${API_URL.replace('/api', '')}/${user.profile_image.replace(/\\/g, '/')}`
                    ) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'Provider'}`} 
                    alt="Profile"
                    className="h-full w-full object-cover" 
                  />
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 hidden sm:block transition-transform ${isProfileOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl z-20 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-slate-50 mb-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Account</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsProfileOpen(false);
                      window.dispatchEvent(new CustomEvent('openProviderProfile'));
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all"
                  >
                    <UserCircle className="h-5 w-5 text-slate-400" />
                    Edit Profile
                  </button>
                  
                  <Link 
                    href="/provider/settings" 
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary transition-all"
                  >
                    <Settings className="h-5 w-5 text-slate-400" />
                    Account Settings
                  </Link>

                  <div className="border-t border-slate-50 mt-2 pt-2">
                    <button 
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-all"
                    >
                      <LogOut className="h-5 w-5" />
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
