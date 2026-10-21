"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Briefcase,
  TrendingUp,
  ShieldCheck,
  Calendar,
  CreditCard,
  Users,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  FileCheck
} from "lucide-react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";

export default function JoinAsProviderPage() {
  const router = useRouter();

  const handleStartRegistration = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user.role === "provider") {
          router.push("/provider/onboarding");
          return;
        }
      } catch {}
    }
    router.push("/provider/register");
  };

  const benefits = [
    {
      icon: TrendingUp,
      title: "Get More Regular Customers",
      desc: "Instant access to thousands of customers looking for home services in your local neighborhood every single day.",
      badge: "High Growth"
    },
    {
      icon: CreditCard,
      title: "Guaranteed & Timely Payouts",
      desc: "Fast, transparent bank transfers for every completed job. No hidden fees or surprise deductions.",
      badge: "Direct Bank Transfer"
    },
    {
      icon: Calendar,
      title: "Be Your Own Boss",
      desc: "Work on your terms. Set your daily working hours, define your service radius, and toggle availability anytime.",
      badge: "Flexible Schedule"
    },
    {
      icon: ShieldCheck,
      title: "Verified & Safe Work",
      desc: "100% verified customer bookings, dedicated 24/7 partner helpline, and job protection policies.",
      badge: "Partner Protection"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Account Registration",
      desc: "Sign up with your mobile number, verify OTP, and set up your professional credentials.",
      icon: Users
    },
    {
      number: "02",
      title: "Choose Services & Areas",
      desc: "Select the service categories you specialize in and specify your city and service radius.",
      icon: MapPin
    },
    {
      number: "03",
      title: "Upload KYC Documents",
      desc: "Submit your Government ID (Aadhaar/PAN) and bank details securely for verification.",
      icon: FileCheck
    },
    {
      number: "04",
      title: "Verification & Start Jobs",
      desc: "Our verification team approves your profile, and you immediately start receiving job requests!",
      icon: Sparkles
    }
  ];

  const inDemandServices = [
    { name: "Electrician Services", img: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80", tag: "High Demand" },
    { name: "Plumbing & Repairs", img: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=500&auto=format&fit=crop&q=80", tag: "Trending" },
    { name: "Home Deep Cleaning", img: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80", tag: "Popular" },
    { name: "Salon & Grooming", img: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&auto=format&fit=crop&q=80", tag: "Daily Jobs" },
    { name: "Appliance & AC Repair", img: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=500&auto=format&fit=crop&q=80", tag: "High Earning" },
    { name: "Carpentry & Assembly", img: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=500&auto=format&fit=crop&q=80", tag: "Essential" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 pt-16 sm:pt-20">
        {/* ─── Hero Section ────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-b from-[#0D1526] via-[#111C33] to-[#0A0F1D] text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          {/* Subtle background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs sm:text-sm font-bold tracking-wide uppercase"
            >
              <Briefcase size={16} /> Partner with BharatClap · Bengaluru
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight text-balance"
            >
              Grow Your Business with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-400">
                BharatClap
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal"
            >
              Get more customers, manage your service requests, and grow your local service business with BharatClap in Bengaluru.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto"
            >
              <button
                onClick={handleStartRegistration}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                <span>Start Provider Registration</span>
                <ArrowRight size={18} />
              </button>

              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm rounded-2xl transition-all text-center"
              >
                Provider Login
              </Link>
            </motion.div>

            {/* Quick Metrics Strip */}
            <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto border-t border-white/10 mt-12">
              <div className="p-4 text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">10,000+</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Verified Partners</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">₹35,000+</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Avg. Monthly Earning</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">0%</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Upfront Joining Fee</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl sm:text-3xl font-black text-white">Weekly</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Direct Bank Payouts</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Why BharatClap Section ──────────────────────────────── */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">
              Why Partner With Us
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything you need to scale your service business
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, idx) => {
              const Icon = b.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all duration-300 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D2B83] flex items-center justify-center">
                      <Icon size={24} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                      {b.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {b.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed flex-1">
                    {b.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── How Onboarding Works ─────────────────────────────────── */}
        <section className="py-16 sm:py-20 bg-white border-y border-slate-200 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">
                Simple & Transparent Flow
              </h2>
              <p className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                How to become an active service professional
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <div key={idx} className="relative group">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 h-full flex flex-col transition-all group-hover:bg-blue-50/50 group-hover:border-blue-200">
                      <div className="flex items-center justify-between mb-5">
                        <span className="text-2xl font-black text-slate-300 group-hover:text-blue-500 transition-colors">
                          {s.number}
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#1D2B83] shadow-sm">
                          <Icon size={20} />
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">
                        {s.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Top Categories in Demand ─────────────────────────────── */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">
              Opportunities Open
            </h2>
            <p className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Top Categories We Are Onboarding
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {inDemandServices.map((cat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col"
              >
                <div className="h-28 overflow-hidden relative">
                  <img
                    src={cat.img}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                    {cat.tag}
                  </span>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs font-bold text-slate-800 line-clamp-1">
                    {cat.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Final Bottom CTA ────────────────────────────────────── */}
        <section className="bg-[#1D2B83] text-white py-14 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">
          <div className="max-w-3xl mx-auto space-y-6 relative z-10">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              Ready to grow your customer base in Bengaluru?
            </h2>
            <p className="text-sm sm:text-base text-blue-100 max-w-xl mx-auto">
              Join thousands of skilled professionals in Bengaluru who rely on BharatClap for steady customer leads and reliable income.
            </p>
            <div className="pt-2">
              <button
                onClick={handleStartRegistration}
                className="px-8 py-4 bg-white text-[#1D2B83] hover:bg-slate-100 font-black text-base rounded-2xl shadow-2xl transition-all transform hover:-translate-y-0.5 inline-flex items-center gap-2"
              >
                <span>Start Provider Registration</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
