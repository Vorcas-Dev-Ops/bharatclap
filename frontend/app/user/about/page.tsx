"use client";

import React from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import {
  Heart, Shield, Star, Zap, Users, Award,
  MapPin, Phone, Mail, ArrowRight, CheckCircle
} from "lucide-react";

const stats = [
  { value: "50,000+",  label: "Happy Customers"    },
  { value: "2,000+",   label: "Expert Providers"   },
  { value: "30+",      label: "Cities Served"       },
  { value: "4.8★",     label: "Average Rating"      },
];

const values = [
  { icon: Shield,  title: "Trust & Safety",      desc: "Every provider is background-checked, trained, and verified before joining the FIXVO network." },
  { icon: Star,    title: "Service Excellence",   desc: "We hold every service to the highest standards. Unsatisfied? We'll fix it or refund — guaranteed." },
  { icon: Zap,     title: "Speed & Reliability",  desc: "Same-day bookings available. Our dispatch system ensures providers arrive on time, every time." },
  { icon: Heart,   title: "Customer First",       desc: "Your satisfaction drives every decision we make. Our support team is available 7 days a week." },
];

const team = [
  { name: "Arjun Mehta",      role: "CEO & Co-Founder",      initials: "AM" },
  { name: "Priya Rajan",      role: "CTO & Co-Founder",      initials: "PR" },
  { name: "Kiran Desai",      role: "Head of Operations",    initials: "KD" },
  { name: "Sunita Rao",       role: "Head of Provider Trust", initials: "SR" },
];

const milestones = [
  { year: "2022", event: "FIXVO founded in Bengaluru" },
  { year: "2023", event: "Launched in 5 cities, 500 providers onboarded" },
  { year: "2024", event: "Reached 10,000 bookings milestone" },
  { year: "2025", event: "Expanded to 30+ cities across India" },
  { year: "2026", event: "50,000+ happy customers and counting" },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#F0F4FF]">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#1D2B83] via-[#2a3da0] to-[#1a237e] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-300 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-black uppercase tracking-widest mb-6">
            <Heart className="w-3 h-3 text-red-400" /> Made in India, for India
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
            About <span className="text-amber-400">FIXVO</span>
          </h1>
          <p className="text-blue-200 text-lg font-medium max-w-xl mx-auto leading-relaxed">
            We connect homeowners with trusted, skilled service professionals — making home maintenance simple, safe, and seamless.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-12 space-y-16">

        {/* Mission */}
        <section className="text-center">
          <h2 className="text-2xl font-black text-slate-900 mb-4">Our Mission</h2>
          <p className="text-slate-500 text-base font-medium leading-relaxed max-w-2xl mx-auto">
            To make every home in India perfectly maintained — by building the most trusted marketplace for skilled home service professionals. We believe in fair earnings for providers and zero-hassle service for customers.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center hover:shadow-md transition-shadow">
              <p className="text-3xl font-black text-[#1D2B83]">{s.value}</p>
              <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">What We Stand For</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {values.map(v => (
              <div key={v.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex gap-4 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <v.icon className="w-5 h-5 text-[#1D2B83]" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 mb-1">{v.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Journey / Timeline */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Our Journey</h2>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {milestones.map((m, i) => (
              <div key={m.year} className={`flex items-start gap-5 px-6 py-5 ${i < milestones.length - 1 ? "border-b border-slate-50" : ""} hover:bg-slate-50/50 transition-colors`}>
                <div className="w-16 flex-shrink-0">
                  <span className="text-sm font-black text-[#1D2B83] bg-blue-100 px-2 py-0.5 rounded-lg">{m.year}</span>
                </div>
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-2 h-2 rounded-full bg-[#1D2B83] mt-1.5 flex-shrink-0" />
                  <p className="text-sm font-bold text-slate-700">{m.event}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section>
          <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Leadership Team</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {team.map(t => (
              <div key={t.name} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center hover:shadow-md transition-shadow">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1D2B83] to-[#3b4cb8] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-900/20">
                  <span className="text-xl font-black text-white">{t.initials}</span>
                </div>
                <p className="text-sm font-black text-slate-800">{t.name}</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">{t.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gradient-to-br from-[#1D2B83] to-[#3b4cb8] rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20">
          <h2 className="text-xl font-black mb-6 text-center">Get In Touch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { icon: MapPin, label: "Office",  value: "Bengaluru, Karnataka, India"     },
              { icon: Mail,   label: "Email",   value: "support@fixvo.in"                },
              { icon: Phone,  label: "Phone",   value: "+91 1800-123-4567 (Toll Free)"   },
            ].map(c => (
              <div key={c.label} className="flex flex-col items-center gap-2 p-4 bg-white/10 rounded-2xl border border-white/10">
                <c.icon className="w-5 h-5 text-blue-200" />
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">{c.label}</p>
                <p className="text-xs font-bold text-white">{c.value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
