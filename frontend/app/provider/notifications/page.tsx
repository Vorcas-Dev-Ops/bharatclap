"use client";

import React, { useState, useEffect } from "react";
import { Bell, Check, Trash2, Calendar, Wallet, Star, Info, MoreHorizontal } from "lucide-react";
import { apiClient } from "@/config/api";
import { connectSocket } from "@/services/socket";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Fetch user details for socket connection
    const storedUser = localStorage.getItem('user');
    let socket: any = null;
    if (storedUser) {
      const user = JSON.parse(storedUser);
      socket = connectSocket(user._id, 'provider');
      
      const handleSocketUpdate = () => {
        fetchNotifications();
      };
      
      socket.on('booking_assigned', handleSocketUpdate);
      socket.on('provider_notification', handleSocketUpdate);
    }

    return () => {
      if (socket) {
        socket.off('booking_assigned');
        socket.off('provider_notification');
      }
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.put(`/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Error marking notification as read", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => apiClient.put(`/notifications/${n._id}/read`, {})));
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error("Error marking all as read", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiClient.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (error) {
      console.error("Error deleting notification", error);
    }
  };

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'booking_alert':
        return { icon: Calendar, color: 'bg-blue-500' };
      case 'payment_alert':
        return { icon: Wallet, color: 'bg-emerald-500' };
      case 'status_update':
        return { icon: Star, color: 'bg-amber-500' };
      default:
        return { icon: Info, color: 'bg-[#1D2B83]' };
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 font-medium">Stay updated with bookings, payments, and account alerts.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={markAllAsRead}
              className="text-sm font-bold text-primary hover:text-[#1D2B83] px-4 py-2 hover:bg-primary/5 rounded-xl transition-all"
            >
              Mark all as read
            </button>
            <button className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 transition-all">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading notifications...</div>
          ) : (
            notifications.map((notif) => {
              const { icon: IconComponent, color } = getIconAndColor(notif.type);
              return (
                <div 
                  key={notif._id} 
                  className={`group bg-white p-6 rounded-[32px] border transition-all ${
                    notif.is_read ? "border-slate-100 shadow-sm opacity-80" : "border-[#1D2B83]/20 shadow-md shadow-primary/5 ring-1 ring-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-6">
                    <div className={`p-3.5 rounded-2xl ${color} text-white shadow-lg shrink-0`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`text-base font-black ${notif.is_read ? "text-slate-700" : "text-slate-900"}`}>
                          {notif.title}
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatTime(notif.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                        {notif.message}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.is_read && (
                        <button 
                          onClick={() => markAsRead(notif._id)}
                          className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteNotification(notif._id)}
                        className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-dashed border-slate-200">
              <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Bell className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">All caught up!</h3>
              <p className="text-slate-400 font-medium">You have no new notifications.</p>
            </div>
          )}
        </div>
      </div>
  );
}
