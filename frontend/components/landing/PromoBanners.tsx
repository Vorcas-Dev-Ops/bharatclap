"use client";
import React, { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Building2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import axios from 'axios';
import { API_URL } from '@/config/api';

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  redirect_url?: string;
  button_text?: string;
}

export default function PromoBanners() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [banners, setBanners] = useState<BannerData[]>([]);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const res = await axios.get(`${API_URL}/banners`);
        setBanners(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 5000); // Auto-scroll every 5 seconds
    return () => clearInterval(timer);
  }, [banners.length]);

  // If no banners are loaded from the database, show a default placeholder banner
  if (banners.length === 0) {
    return (
      <section className="bg-white py-8 sm:py-12 pb-20 sm:pb-24 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
          <div className="relative w-full h-[400px] sm:h-[500px]">
            <div className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-[#1D2B83] p-8 sm:p-16 text-white shadow-2xl flex flex-col justify-center items-center text-center">
              <h2 className="text-2xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-4">
                Exclusive Promotions
              </h2>
              <p className="text-white text-xs sm:text-lg opacity-90 leading-relaxed font-medium">
                New offers coming soon! Stay tuned.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const currentBanner = banners[activeIndex];
  const isEvenLayout = activeIndex % 2 === 0;

  const handleBannerClick = (e: React.MouseEvent<HTMLAnchorElement>, url?: string) => {
    if (!url) return;
    
    // Dispatch event for categories component to handle modal opening
    const event = new CustomEvent("openCategoryModal", { detail: { url } });
    window.dispatchEvent(event);
    
    // If it's one of the known categories that opens a modal, prevent navigation
    if (url.includes("bulk") || url.includes("loan")) {
      e.preventDefault();
    }
  };

  return (
    <section className="bg-white py-8 sm:py-12 pb-20 sm:pb-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="relative w-full h-[550px] sm:h-[500px]">
          <AnimatePresence mode="wait">
            {isEvenLayout ? (
              <motion.div
                key={`even-${currentBanner._id}`}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] bg-[#1D2B83] p-8 sm:p-16 text-white shadow-2xl"
              >
                {/* Decorative Background Elements */}
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/5 blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/10 blur-2xl" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center relative z-10 h-full">
                  <div className="flex flex-col gap-4 sm:gap-6 max-w-xl text-center md:text-left items-center md:items-start">
                    <div className="flex items-center gap-3 bg-white/10 w-fit px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
                      <ShieldCheck className="h-4 w-4 text-indigo-200" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                        Exclusive Offer
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                      {currentBanner.title}
                    </h2>

                    <p className="text-indigo-100 text-xs sm:text-lg opacity-80 leading-relaxed font-medium">
                      {currentBanner.subtitle}
                    </p>

                    {currentBanner.button_text && (
                      <div className="mt-4">
                        <Link 
                          href={currentBanner.redirect_url || "/"} 
                          onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                          className="relative overflow-hidden bg-white text-[#1D2B83] hover:text-white text-xs sm:text-sm font-bold uppercase tracking-[0.2em] px-8 sm:px-10 py-4 sm:py-5 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-105 flex items-center gap-3 group isolate"
                        >
                          <div className="absolute inset-0 bg-indigo-500 scale-x-0 origin-left transition-transform duration-500 ease-out group-hover:scale-x-100 -z-10" />
                          {currentBanner.button_text}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-2" />
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="relative hidden md:flex justify-center items-center h-full">
                    <div className="h-72 w-72 md:h-[350px] md:w-[350px] rounded-[3rem] bg-indigo-500/20 backdrop-blur-3xl p-8 relative isolate overflow-hidden group">
                      <img src={currentBanner.image_url} alt={currentBanner.title} className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 mix-blend-overlay" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`odd-${currentBanner._id}`}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a)" }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-16 text-white shadow-2xl border border-white/10"
              >
                <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl animate-pulse" />
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-blue-400/10 blur-2xl" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center relative z-10 h-full">
                  <div className="flex flex-col gap-4 sm:gap-6 max-w-xl flex-1 text-center md:text-left items-center md:items-start">
                    <div className="inline-flex w-fit items-center gap-3 bg-white/10 text-indigo-200 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <Building2 className="h-5 w-5" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                        Featured Service
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
                      {currentBanner.title}
                    </h2>

                    <p className="text-indigo-100 text-xs sm:text-lg max-w-lg leading-relaxed font-medium opacity-80">
                      {currentBanner.subtitle}
                    </p>

                    {currentBanner.button_text && (
                      <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
                        <Link 
                          href={currentBanner.redirect_url || "/"} 
                          onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                          className="relative overflow-hidden bg-white text-[#1D2B83] hover:text-white text-xs sm:text-sm font-bold uppercase tracking-[0.2em] px-8 sm:px-10 py-4 sm:py-5 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-105 flex items-center gap-3 group isolate"
                        >
                          <div className="absolute inset-0 bg-indigo-500 scale-x-0 origin-left transition-transform duration-500 ease-out group-hover:scale-x-100 -z-10" />
                          {currentBanner.button_text}
                          <span className="ml-3 h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center transition-transform group-hover:translate-x-1">
                            <ChevronRight className="h-3 w-3 text-slate-900" />
                          </span>
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="hidden md:flex flex-1 w-full justify-center items-center relative h-full">
                    <div className="h-72 w-72 md:h-[350px] md:w-[350px] rounded-[3rem] overflow-hidden shadow-2xl relative isolate border-4 border-white/10 group">
                      <img src={currentBanner.image_url} alt={currentBanner.title} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 mix-blend-overlay" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Carousel Indicators */}
        {banners.length > 1 && (
          <div className="absolute -bottom-6 sm:-bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`transition-all duration-300 rounded-full ${activeIndex === idx ? "w-8 sm:w-10 h-1.5 sm:h-2 bg-[#1D2B83]" : "w-1.5 sm:w-2 h-1.5 sm:h-2 bg-slate-300 hover:bg-slate-400"}`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
