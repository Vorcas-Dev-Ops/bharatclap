"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import { Ticket, Copy, CheckCheck, Search, Tag, Clock, Zap, Gift } from "lucide-react";
import axios from "axios";
import { API_URL } from "@/config/api";
import { Skeleton } from "antd";

const typeColor: Record<string, string> = {
  flat: "from-violet-500 to-purple-600",
  percent: "from-blue-500 to-indigo-600",
  percentage: "from-blue-500 to-indigo-600",
  cashback: "from-emerald-500 to-teal-600",
};

const OffersPage = () => {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [autoOffers, setAutoOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/coupons`);
      const allCoupons = res.data;
      
      // Filter active coupons
      const activeCoupons = allCoupons.filter((c: any) => c.status === 'active');
      
      // Separate auto-apply offers and manual coupons
      setCoupons(activeCoupons.filter((c: any) => !c.autoApply));
      setAutoOffers(activeCoupons.filter((c: any) => c.autoApply));
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => { });
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const getExpiryText = (date: string) => {
    const expiry = new Date(date);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Expires today";
    if (diffDays === 1) return "Expires tomorrow";
    return `${diffDays} days left`;
  };

  const filtered = coupons.filter(c =>
    (c.code?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.name?.toLowerCase() || '').includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-[1440px] mx-auto px-1 py-8 space-y-12">

        {/* ── Row 1: Centered Heading ────────────────────────────────── */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Offers & Coupons</h1>
          <div className="w-16 h-1.5 bg-[#1D2B83] mx-auto rounded-full opacity-20" />
        </div>

        {/* ── Row 2: Centered Search ──────────────────────────────────── */}
        <div className="max-w-2xl mx-auto">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#1D2B83] transition-colors" />
            <input
              type="text"
              placeholder="Search coupon codes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border-2 border-slate-100 rounded-[2rem] text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] transition-all shadow-sm hover:shadow-md"
            />
          </div>
        </div>

        {/* ── Row 3: Two Columns ──────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* Column 1: Available Coupons */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[13px]">
                <Tag className="w-5 h-5 text-[#1D2B83]" /> Available Coupons ({loading ? '...' : filtered.length})
              </h2>
              {filtered.length > 0 && (
                <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] rounded-full text-[10px] font-black tracking-widest uppercase">
                  Best Value
                </span>
              )}
            </div>

            <style>{`
              @keyframes confetti-burst {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                100% { transform: translate(var(--tx), var(--ty)) scale(1); opacity: 0; }
              }
              .animate-confetti {
                animation: confetti-burst 0.8s ease-out forwards;
              }
            `}</style>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="bg-white rounded-3xl p-4 border border-slate-100 h-64">
                    <Skeleton active paragraph={{ rows: 4 }} />
                  </div>
                ))
              ) : (
                filtered.map(c => (
                  <div key={c._id} className="group bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 relative">
                    
                    {/* Celebration Effect */}
                    {copied === c.code && (
                      <div className="absolute inset-0 z-50 pointer-events-none">
                        {[...Array(16)].map((_, i) => (
                          <div 
                            key={i} 
                            className="absolute w-2 h-2 rounded-full animate-confetti"
                            style={{
                              backgroundColor: ['#6366f1', '#a855f7', '#ec4899', '#22c55e', '#f59e0b'][i % 5],
                              left: '50%',
                              top: '50%',
                              '--tx': `${(Math.random() - 0.5) * 300}%`,
                              '--ty': `${(Math.random() - 0.5) * 300}%`,
                            } as any}
                          />
                        ))}
                      </div>
                    )}

                    <div className={`p-4 pb-6 text-white relative overflow-hidden bg-gradient-to-br ${typeColor[c.discountType] || typeColor.flat}`}>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl" />
                      <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/5 rounded-full -ml-10 -mb-10 blur-xl" />
                      
                      <div className="relative flex items-start justify-between mb-2">
                        <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                          <Ticket className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                          {c.discountType === 'percentage' ? '%' : 'Flat'}
                        </span>
                      </div>
                      <div className="relative">
                        <p className="text-xl font-black tracking-tighter leading-tight">
                          {c.discountType === 'percentage' ? `${c.discountValue}% Off` : `₹${c.discountValue} Off`}
                        </p>
                        <p className="text-white/90 text-[9px] font-bold uppercase tracking-wider line-clamp-1">{c.description}</p>
                      </div>
                    </div>

                    {/* Perforated edge effect */}
                    <div className="relative flex items-center px-4 -mt-3 z-10">
                      <div className="absolute -left-2 w-4 h-4 rounded-full bg-slate-50" />
                      <div className="flex-1 border-t-2 border-dashed border-slate-100 mx-2" />
                      <div className="absolute -right-2 w-4 h-4 rounded-full bg-slate-50" />
                    </div>

                    <div className="p-4 pt-3 space-y-4 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 border border-slate-100 border-dashed rounded-xl px-2 py-2 font-black text-xs text-slate-700 tracking-widest text-center uppercase truncate">
                          {c.code}
                        </div>
                        <button 
                          onClick={() => handleCopy(c.code)}
                          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${copied === c.code ? "bg-emerald-500 text-white scale-110" : "bg-[#1D2B83] text-white hover:bg-blue-900"}`}
                        >
                          {copied === c.code ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="text-[9px] font-black text-amber-600 uppercase">{getExpiryText(c.expiryDate)}</span>
                        </div>
                        {c.minOrderAmount > 0 && (
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                            Min: ₹{c.minOrderAmount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {!loading && filtered.length === 0 && (
              <div className="py-24 text-center bg-white rounded-[3rem] border border-slate-100 border-dashed">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">No match found</h3>
                <p className="text-slate-400 font-medium mt-1">Try another coupon code or keyword</p>
              </div>
            )}
          </div>

          {/* Column 2: Auto-Applied Offers */}
          <div className="w-full lg:w-96 space-y-6 lg:sticky lg:top-24">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2 px-2 uppercase tracking-widest text-[13px]">
              <Zap className="w-5 h-5 text-amber-500" /> Auto-Applied
            </h2>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {loading ? (
                [1, 2].map(i => (
                  <div key={i} className="p-7">
                    <Skeleton active avatar paragraph={{ rows: 1 }} />
                  </div>
                ))
              ) : autoOffers.length > 0 ? (
                autoOffers.map((o, i) => (
                  <div key={o._id} className="p-7 flex items-start gap-5 hover:bg-slate-50/50 transition-colors group">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                      <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-base font-black text-slate-800 tracking-tight line-clamp-1">{o.name}</p>
                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-lg uppercase tracking-wider backdrop-blur-sm">Auto</span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed line-clamp-2">{o.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                  No automatic offers active
                </div>
              )}

              <div className="p-8 bg-blue-50/30">
                <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm text-center">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Did you know?</p>
                  <p className="text-[13px] font-bold text-slate-600 leading-snug">
                    Auto-applied offers are calculated instantly at checkout for maximum savings!
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </main>
  );
};

export default OffersPage;
