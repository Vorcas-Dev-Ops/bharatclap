"use client";

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import { Search, ChevronDown, ChevronUp, User, Briefcase, HelpCircle, PhoneCall, Clock, Eye, Flame, History } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

interface FAQ {
  id: string;
  category: "customer" | "provider" | "general";
  q: string;
  a: string;
  popular?: boolean;
}

const faqs: FAQ[] = [
  // Customer FAQs
  { id: "faq-c1", category: "customer", popular: true, q: "How to book a service on BharatClap?", a: "Browse categories or search for a service, select your required package, pick a convenient date & time slot, enter your delivery address, and proceed with payment or choose Cash on Delivery." },
  { id: "faq-c2", category: "customer", popular: true, q: "How to cancel a booking?", a: "Go to My Bookings, select the active booking, and tap 'Cancel Booking'. Free cancellation is allowed up to 1 hour before slot time. Late cancellations incur a ₹99 fee." },
  { id: "faq-c3", category: "customer", q: "What should I do if my payment failed?", a: "If money was debited during a failed transaction, Razorpay automatically refunds it to your source account within 24 hours. You can also re-try paying via UPI or choose COD." },
  { id: "faq-c4", category: "customer", popular: true, q: "How to check my refund status?", a: "Open 'Refund Policy' or navigate to your wallet under Profile. Refunds processed to BharatClap Wallet reflect instantly; UPI/bank refunds take 1–3 business days." },
  { id: "faq-c5", category: "customer", q: "How does the BharatClap Wallet work?", a: "Your wallet holds refund credits, cashbacks, and referral bonuses. You can use your wallet balance during checkout for instant discounts or request a withdrawal." },
  { id: "faq-c6", category: "customer", q: "What benefits come with BharatClap Plus Membership?", a: "Plus members get 0 convenience fees on all bookings, free instant rescheduling, priority provider dispatch, and exclusive 10% discounts on premium services." },
  { id: "faq-c7", category: "customer", q: "How does the Referral Program work?", a: "Share your referral code with friends. When they complete their first booking, both you and your friend receive ₹100 wallet credits!" },
  { id: "faq-c8", category: "customer", popular: true, q: "What are OTP issues and why is 4-digit OTP required?", a: "To guarantee job security and quality, you receive a 4-digit OTP on your mobile. Only share this OTP with your provider once the service is completely finished." },

  // Provider FAQs
  { id: "faq-p1", category: "provider", popular: true, q: "How do I complete KYC verification as a Provider?", a: "Upload your Aadhaar, PAN card, address proof, and bank account details via the Partner App under Profile -> KYC Documents. Verification is completed within 24-48 hours." },
  { id: "faq-p2", category: "provider", q: "How does the Provider Wallet work?", a: "Your wallet credits reflect completed service earnings minus platform commissions. Maintain a minimum balance of ₹500 to keep receiving new lead dispatches." },
  { id: "faq-p3", category: "provider", q: "How is Cash on Delivery (COD) handled?", a: "When you collect cash directly from a customer, the platform commission for that job is automatically deducted from your Provider Wallet balance." },
  { id: "faq-p4", category: "provider", q: "What are Lead Packages?", a: "Lead packages allow service partners to purchase credit packs for high-value booking alerts and guaranteed job dispatch priority." },
  { id: "faq-p5", category: "provider", popular: true, q: "When are Settlements and Payouts processed?", a: "Settlements are transferred directly to your verified bank account twice weekly (Tuesdays & Fridays) or instantly on demand via Instant Payouts." },
  { id: "faq-p6", category: "provider", q: "How to manage my Availability?", a: "Toggle your online/offline status in the Partner App top bar, or set custom working hours under Schedule Settings." },

  // General FAQs
  { id: "faq-g1", category: "general", q: "How to manage my Account settings?", a: "Tap on Profile -> Settings to update your name, email, saved addresses, phone number, and notification preferences." },
  { id: "faq-g2", category: "general", q: "Is my personal data secure with BharatClap?", a: "Yes. All data is encrypted in transit and at rest. We never sell your personal information to third-party advertisers." },
  { id: "faq-g3", category: "general", popular: true, q: "What payment methods are supported?", a: "We support Razorpay payments including UPI (GPay, PhonePe, Paytm), Credit Cards, Debit Cards, Netbanking, BharatClap Wallet, and Cash on Delivery (COD)." },
];

export default function HelpCenterPage() {
  const { platformName, supportPhone, workingHours, policiesVersion, lastUpdated } = useSettings();
  const [activeTab, setActiveTab] = useState<"all" | "customer" | "provider" | "general">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([]);

  const handleToggleFaq = (id: string, qText: string) => {
    const isOpening = openId !== id;
    setOpenId(isOpening ? id : null);
    if (isOpening && !recentlyViewed.includes(qText)) {
      setRecentlyViewed((prev) => [qText, ...prev.slice(0, 4)]);
    }
  };

  const filteredFaqs = faqs.filter((item) => {
    const matchesTab = activeTab === "all" || item.category === activeTab;
    const matchesSearch = item.q.toLowerCase().includes(query.toLowerCase()) || item.a.toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const popularArticles = faqs.filter((f) => f.popular);

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-to-r from-[#1D2B83] to-[#2A3DA8] text-white py-14 px-4 sm:px-6 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto space-y-4 relative z-10">
          <div className="flex items-center justify-center gap-2">
            <span className="px-3 py-1 bg-white/10 text-blue-200 text-[11px] font-black uppercase tracking-widest rounded-full border border-white/20">
              24/7 Self-Service Knowledge Base
            </span>
            <span className="px-2.5 py-1 bg-blue-900/60 text-blue-300 text-[10px] font-mono rounded-full border border-blue-700">
              Version {policiesVersion}
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight">How can we help you on {platformName}?</h1>
          <p className="text-blue-100 text-xs sm:text-sm font-medium max-w-xl mx-auto">
            Search topics or select categories below. Last updated: <strong>{lastUpdated}</strong>.
          </p>

          {/* Search bar */}
          <div className="relative max-w-2xl mx-auto mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help topics (e.g. refund, OTP, KYC, wallet, cancellation)..."
              className="w-full pl-12 pr-4 py-3.5 bg-white text-slate-900 placeholder-slate-400 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-blue-300 shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        
        {/* Popular Articles Carousel Strip */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-[#1D2B83] flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" /> Popular Help Topics
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {popularArticles.map((art) => (
              <button
                key={art.id}
                onClick={() => {
                  setActiveTab("all");
                  setQuery(art.q);
                  setOpenId(art.id);
                }}
                className="flex-shrink-0 p-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-2xl text-left text-xs font-bold text-slate-800 hover:text-[#1D2B83] transition-all max-w-xs shadow-xs"
              >
                🔥 {art.q}
              </button>
            ))}
          </div>
        </div>

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-[#1D2B83] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-600" /> Recently Viewed
            </h3>
            <ul className="flex flex-wrap gap-2 text-xs text-slate-700 font-medium">
              {recentlyViewed.map((qText, i) => (
                <li key={i} className="px-3 py-1 bg-white rounded-lg border border-slate-200">
                  {qText}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === "all" ? "bg-[#1D2B83] text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <HelpCircle className="w-4 h-4" /> All FAQs ({faqs.length})
          </button>
          <button
            onClick={() => setActiveTab("customer")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === "customer" ? "bg-[#1D2B83] text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <User className="w-4 h-4" /> Customer Help
          </button>
          <button
            onClick={() => setActiveTab("provider")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === "provider" ? "bg-[#1D2B83] text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <Briefcase className="w-4 h-4" /> Provider Help
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
              activeTab === "general" ? "bg-[#1D2B83] text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            <HelpCircle className="w-4 h-4" /> General &amp; Security
          </button>
        </div>

        {/* FAQs Accordion */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium text-sm">
              No matching questions found for &quot;{query}&quot;. Please call support directly.
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div key={faq.id} className="group">
                  <button
                    onClick={() => handleToggleFaq(faq.id, faq.q)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#1D2B83] pr-4 flex items-center gap-2">
                      {faq.popular && <span className="text-xs">🔥</span>}
                      {faq.q}
                    </span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform ${isOpen ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-500"}`}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs sm:text-sm text-slate-600 leading-relaxed bg-blue-50/40 border-l-4 border-[#1D2B83]">
                      <p className="pt-3">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Call Support Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-[#1D2B83] p-8 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-xl font-black">Still need immediate help?</h3>
            <p className="text-xs text-blue-200">Our official helpline is available {workingHours}.</p>
          </div>
          <a
            href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`}
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-transform active:scale-95 flex-shrink-0"
          >
            <PhoneCall className="w-4 h-4" /> Call {supportPhone}
          </a>
        </div>
      </div>

      <Footer />
    </main>
  );
}
