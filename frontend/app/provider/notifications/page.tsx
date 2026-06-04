"use client";

import React, { useState } from "react";
import ProviderLayout from "@/components/provider/ProviderLayout";
import { Bell, Check, Trash2, Calendar, Wallet, Star, Info, MoreHorizontal } from "lucide-react";

const initialNotifications = [
  {
    id: 1,
    title: "New Booking Request",
    message: "Priya Singh has requested a Deep Home Cleaning for today at 10:00 AM.",
    type: "booking",
    time: "5 mins ago",
    isRead: false,
    icon: Calendar,
    color: "bg-blue-500"
  },
  {
    id: 2,
    title: "Payment Received",
    message: "₹2,499 has been added to your wallet for booking BK-9810.",
    type: "payment",
    time: "1 hour ago",
    isRead: false,
    icon: Wallet,
    color: "bg-emerald-500"
  },
  {
    id: 3,
    title: "New Review",
    message: "Ananya Kapoor left a 5-star review for your service.",
    type: "review",
    time: "2 hours ago",
    isRead: true,
    icon: Star,
    color: "bg-amber-500"
  },
  {
    id: 4,
    title: "System Update",
    message: "New terms of service are active. Please review them in settings.",
    type: "info",
    time: "Yesterday",
    isRead: true,
    icon: Info,
    color: "bg-primary"
  }
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <ProviderLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-slate-500 font-medium">Stay updated with bookings, payments, and account alerts.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={markAllAsRead}
              className="text-sm font-bold text-primary hover:text-primary-dark px-4 py-2 hover:bg-primary/5 rounded-xl transition-all"
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
          {notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`group bg-white p-6 rounded-[32px] border transition-all ${
                notif.isRead ? "border-slate-100 shadow-sm opacity-80" : "border-primary/20 shadow-md shadow-primary/5 ring-1 ring-primary/5"
              }`}
            >
              <div className="flex items-start gap-6">
                <div className={`p-3.5 rounded-2xl ${notif.color} text-white shadow-lg shrink-0`}>
                  <notif.icon className="h-6 w-6" />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-base font-black ${notif.isRead ? "text-slate-700" : "text-slate-900"}`}>
                      {notif.title}
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{notif.time}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-2xl">
                    {notif.message}
                  </p>
                </div>

                <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notif.isRead && (
                    <button className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all">
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notif.id)}
                    className="p-2 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
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
    </ProviderLayout>
  );
}
