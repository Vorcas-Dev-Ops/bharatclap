"use client";

import React from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-16 text-center mt-20">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Notifications</h1>
        <div className="w-12 h-1 bg-[#1D2B83] mx-auto mt-2 rounded-full opacity-20 mb-8" />
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100">
          <p className="text-slate-500 font-medium">No new notifications at this time.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
