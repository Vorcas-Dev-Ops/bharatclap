"use client";

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import {
  Gift, Copy, CheckCheck, Share2, Users, Clock,
  MessageCircle, Phone, Mail, ChevronRight, Wallet,
  ArrowRight, UserPlus
} from "lucide-react";

const referralCode = "FIXVO-SUMANTH123";

const referralHistory = [
  { name: "Arjun M.",    date: "10 May 2026", status: "earned",  reward: 200 },
  { name: "Priya S.",    date: "6 May 2026",  status: "pending", reward: 200 },
  { name: "Kiran R.",    date: "1 May 2026",  status: "earned",  reward: 200 },
  { name: "Deepa T.",    date: "28 Apr 2026", status: "earned",  reward: 200 },
];

const shareOptions = [
  { label: "WhatsApp", color: "bg-emerald-500 hover:bg-emerald-600", icon: MessageCircle },
  { label: "Copy Link", color: "bg-slate-700 hover:bg-slate-800",    icon: Copy          },
  { label: "SMS",       color: "bg-blue-600 hover:bg-blue-700",      icon: Phone         },
  { label: "Email",     color: "bg-violet-600 hover:bg-violet-700",  icon: Mail          },
];

export default function ReferPage() {
  const [codeCopied, setCodeCopied] = useState(false);

  const totalEarned  = referralHistory.filter(r => r.status === "earned").reduce((s, r) => s + r.reward, 0);
  const totalPending = referralHistory.filter(r => r.status === "pending").reduce((s, r) => s + r.reward, 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-[#F0F4FF]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Refer & Earn</h1>
          <p className="text-slate-500 mt-1 font-medium">Invite friends and earn ₹200 for every successful referral</p>
        </div>

        {/* Hero Banner */}
        <div className="relative bg-gradient-to-br from-[#1D2B83] to-[#3b4cb8] rounded-3xl p-8 text-white overflow-hidden shadow-2xl shadow-blue-900/30">
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
              <Gift className="w-10 h-10 text-amber-400" />
            </div>
            <div>
              <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-1">Per Referral</p>
              <p className="text-5xl font-black text-amber-400">₹200</p>
              <p className="text-blue-200 text-sm font-medium mt-1">Your friend also gets ₹100 off their first booking!</p>
            </div>
          </div>
        </div>

        {/* Earnings Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Earned",  value: `₹${totalEarned}`,  color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Pending",       value: `₹${totalPending}`, color: "text-amber-600",   bg: "bg-amber-50"   },
            { label: "Friends Joined",value: referralHistory.filter(r=>r.status==="earned").length, color: "text-blue-600", bg: "bg-blue-50" },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-2xl p-4 text-center border border-white`}>
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-[11px] font-bold text-slate-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Referral Code */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-black text-slate-900">Your Referral Code</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-2xl px-4 py-3.5 font-black text-sm text-slate-700 tracking-[0.15em] border-2 border-dashed border-slate-300">
              {referralCode}
            </div>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black transition-all ${
                codeCopied ? "bg-emerald-500 text-white" : "bg-[#1D2B83] text-white hover:opacity-90"
              }`}
            >
              {codeCopied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {codeCopied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Share Options */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Share via</p>
            <div className="grid grid-cols-4 gap-3">
              {shareOptions.map(s => (
                <button
                  key={s.label}
                  className={`${s.color} text-white rounded-2xl py-3 flex flex-col items-center gap-1.5 transition-all hover:scale-105 text-xs font-black`}
                >
                  <s.icon className="w-5 h-5" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <h2 className="text-base font-black text-slate-900">How It Works</h2>
          </div>
          <div className="p-6 flex flex-col sm:flex-row gap-4">
            {[
              { step: "1", label: "Share Code",       desc: "Send your code to friends" },
              { step: "2", label: "Friend Signs Up",  desc: "They register & book a service" },
              { step: "3", label: "You Earn ₹200",    desc: "Credited to your wallet" },
            ].map((s, i, arr) => (
              <React.Fragment key={s.step}>
                <div className="flex-1 flex flex-col items-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-[#1D2B83] text-white font-black text-sm flex items-center justify-center shadow-lg shadow-blue-900/20">
                    {s.step}
                  </div>
                  <p className="text-sm font-black text-slate-800">{s.label}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{s.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden sm:flex items-center text-slate-300">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Referral History */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1D2B83]" /> Referral History
            </h2>
          </div>
          <div className="divide-y divide-slate-50">
            {referralHistory.map((r, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="w-4 h-4 text-[#1D2B83]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-800">{r.name} joined</p>
                  <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {r.date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-600">+₹{r.reward}</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    r.status === "earned" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {r.status === "earned" ? "Earned" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
