"use client";

import React, { useState, useEffect } from "react";
import { ArrowRight, ShieldCheck, Building2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useHomeData } from "@/hooks/useHomeData";

export interface BannerData {
  _id: string;
  id?: string;
  title: string;
  subtitle?: string;
  image?: string;
  image_url?: string;
  redirect_url?: string;
  redirect_type?: string;
  button_text?: string;
  background_color?: string;
  backgroundColor?: string;
  text_color?: string;
  textColor?: string;
  template_config?: {
    template?: 'split' | 'full_background' | 'image_left' | 'centered_promo' | 'highlight_deal';
    badge_text?: string | null;
    badge_style?: 'pill' | 'rounded' | null;
    highlight_text?: string | null;
    overlay?: {
      type?: 'none' | 'dark' | 'light' | 'gradient';
      opacity?: number;
    } | null;
  };
  placement?: string;
  position?: number;
  audience?: string;
  status?: string;
}

interface BannerSlotProps {
  placement: string;
  className?: string;
}

export default function BannerSlot({ placement, className = "" }: BannerSlotProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { banners: bffBanners } = useHomeData();

  // Filter banners belonging to this placement slot
  const slotBanners: BannerData[] = React.useMemo(() => {
    if (!Array.isArray(bffBanners)) return [];
    return bffBanners
      .filter((b: any) => {
        const bPlacement = b.placement || "homepage_after_categories";
        return bPlacement === placement;
      })
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  }, [bffBanners, placement]);

  useEffect(() => {
    if (slotBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slotBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slotBanners.length]);

  // If no banners are assigned to this slot, render nothing (no hardcoded filler)
  if (slotBanners.length === 0) {
    return null;
  }

  const currentBanner = slotBanners[activeIndex % slotBanners.length];
  const bannerImage = currentBanner.image_url || currentBanner.image || "";

  const handleBannerClick = (e: React.MouseEvent<HTMLAnchorElement>, url?: string) => {
    if (!url) return;

    // Dispatch event for categories component to handle modal opening
    const event = new CustomEvent("openCategoryModal", { detail: { url } });
    window.dispatchEvent(event);

    if (url.includes("bulk") || url.includes("loan")) {
      e.preventDefault();
    }
  };

  const isImageOnly = !currentBanner.title && bannerImage;
  const tmpl = currentBanner.template_config?.template || "split";
  const badgeText = currentBanner.template_config?.badge_text;
  const badgeStyle = currentBanner.template_config?.badge_style || "pill";
  const highlightText = currentBanner.template_config?.highlight_text;
  const overlay = currentBanner.template_config?.overlay;

  const textColor = currentBanner.text_color || currentBanner.textColor || "#FFFFFF";
  const bgColor = currentBanner.background_color || currentBanner.backgroundColor || "#5E2FD9";

  return (
    <section className={`bg-white py-6 sm:py-10 relative overflow-hidden ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="relative w-full h-[380px] sm:h-[460px]">
          <AnimatePresence mode="wait">
            {isImageOnly ? (
              <motion.div
                key={`img-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] shadow-xl"
              >
                {currentBanner.redirect_url ? (
                  <Link
                    href={currentBanner.redirect_url}
                    onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                    className="block w-full h-full"
                  >
                    <img
                      src={bannerImage}
                      alt={currentBanner.title || "Banner"}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                    />
                  </Link>
                ) : (
                  <img
                    src={bannerImage}
                    alt={currentBanner.title || "Banner"}
                    className="w-full h-full object-cover"
                  />
                )}
              </motion.div>
            ) : tmpl === "full_background" ? (
              /* ── TEMPLATE: FULL BACKGROUND ─────────────────────────── */
              <motion.div
                key={`fullbg-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5 }}
                style={{
                  backgroundColor: bgColor,
                  backgroundImage: bannerImage ? `url(${bannerImage})` : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 text-white shadow-2xl flex items-center"
              >
                {/* Backdrop Overlay */}
                <div
                  style={{
                    backgroundColor:
                      overlay?.type === "light"
                        ? `rgba(255,255,255,${overlay?.opacity ?? 0.5})`
                        : overlay?.type === "none"
                        ? "transparent"
                        : `rgba(0,0,0,${overlay?.opacity ?? 0.55})`,
                  }}
                  className="absolute inset-0 pointer-events-none"
                />

                <div className="relative z-10 max-w-2xl space-y-4 sm:space-y-6">
                  {badgeText && (
                    <div className={`inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 border border-white/20 ${badgeStyle === "rounded" ? "rounded-xl" : "rounded-full"}`}>
                      <ShieldCheck className="h-4 w-4" style={{ color: textColor }} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: textColor }}>
                        {badgeText}
                      </span>
                    </div>
                  )}

                  <h2 style={{ color: textColor }} className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight drop-shadow-md">
                    {currentBanner.title}
                  </h2>

                  {currentBanner.subtitle && (
                    <p style={{ color: textColor }} className="text-sm sm:text-lg opacity-90 leading-relaxed font-medium drop-shadow-sm max-w-xl">
                      {currentBanner.subtitle}
                    </p>
                  )}

                  {highlightText && (
                    <div className="inline-block px-4 py-1.5 bg-amber-400 text-slate-900 rounded-xl text-xs sm:text-sm font-black shadow-lg">
                      {highlightText}
                    </div>
                  )}

                  {currentBanner.button_text && (
                    <div className="pt-2">
                      <Link
                        href={currentBanner.redirect_url || "/"}
                        onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                        className="inline-flex items-center gap-3 bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-extrabold uppercase tracking-[0.15em] px-8 py-4 rounded-xl shadow-xl transition-all duration-300 hover:scale-105"
                      >
                        {currentBanner.button_text}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : tmpl === "centered_promo" ? (
              /* ── TEMPLATE: CENTERED PROMO ──────────────────────────── */
              <motion.div
                key={`centered-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                style={{ backgroundColor: bgColor }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 text-white shadow-2xl flex flex-col items-center justify-center text-center"
              >
                <div className="relative z-10 max-w-2xl space-y-4 flex flex-col items-center">
                  <div className={`inline-flex items-center gap-2 bg-white/10 px-4 py-1.5 border border-white/10 ${badgeStyle === "rounded" ? "rounded-xl" : "rounded-full"}`}>
                    <Building2 className="h-4 w-4" style={{ color: textColor }} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: textColor }}>
                      {badgeText || "Special Promotion"}
                    </span>
                  </div>

                  <h2 style={{ color: textColor }} className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                    {currentBanner.title}
                  </h2>

                  {currentBanner.subtitle && (
                    <p style={{ color: textColor }} className="text-xs sm:text-base opacity-85 leading-relaxed font-medium max-w-lg">
                      {currentBanner.subtitle}
                    </p>
                  )}

                  {highlightText && (
                    <div className="px-4 py-1.5 bg-amber-400 text-slate-900 rounded-xl text-xs sm:text-sm font-black shadow-md">
                      {highlightText}
                    </div>
                  )}

                  {currentBanner.button_text && (
                    <div className="pt-2">
                      <Link
                        href={currentBanner.redirect_url || "/"}
                        onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                        className="inline-flex items-center gap-2.5 bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-extrabold uppercase tracking-[0.15em] px-8 py-3.5 rounded-xl shadow-xl transition-all duration-300 hover:scale-105"
                      >
                        {currentBanner.button_text}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : tmpl === "image_left" ? (
              /* ── TEMPLATE: IMAGE LEFT ──────────────────────────────── */
              <motion.div
                key={`imgleft-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, x: -60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ backgroundColor: bgColor }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 text-white shadow-2xl flex items-center"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center relative z-10 w-full">
                  {bannerImage && (
                    <div className="hidden md:flex justify-center items-center h-full order-1">
                      <div className="h-64 w-64 md:h-[300px] md:w-[300px] rounded-[2.5rem] bg-black/20 backdrop-blur-2xl p-4 relative isolate overflow-hidden group border border-white/10 shadow-2xl">
                        <img
                          src={bannerImage}
                          alt={currentBanner.title || "Banner"}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 sm:gap-5 max-w-xl text-center md:text-left items-center md:items-start order-2">
                    <div className={`flex items-center gap-2.5 bg-white/10 w-fit px-3.5 py-1.5 border border-white/10 backdrop-blur-sm ${badgeStyle === "rounded" ? "rounded-xl" : "rounded-full"}`}>
                      <ShieldCheck className="h-4 w-4" style={{ color: textColor }} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: textColor }}>
                        {badgeText || "Featured Offer"}
                      </span>
                    </div>

                    <h2 style={{ color: textColor }} className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                      {currentBanner.title}
                    </h2>

                    {currentBanner.subtitle && (
                      <p style={{ color: textColor }} className="text-xs sm:text-base opacity-85 leading-relaxed font-medium">
                        {currentBanner.subtitle}
                      </p>
                    )}

                    {highlightText && (
                      <span className="px-3.5 py-1.5 bg-amber-400 text-slate-900 rounded-lg text-xs font-black">
                        {highlightText}
                      </span>
                    )}

                    {currentBanner.button_text && (
                      <div className="mt-2">
                        <Link
                          href={currentBanner.redirect_url || "/"}
                          onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                          className="relative overflow-hidden bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-bold uppercase tracking-[0.15em] px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2.5 group isolate"
                        >
                          {currentBanner.button_text}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : tmpl === "highlight_deal" ? (
              /* ── TEMPLATE: HIGHLIGHT DEAL ──────────────────────────── */
              <motion.div
                key={`deal-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                style={{ backgroundColor: bgColor }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 text-white shadow-2xl flex items-center"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-center relative z-10 w-full">
                  <div className="md:col-span-2 flex flex-col gap-4 text-center md:text-left items-center md:items-start">
                    <div className={`flex items-center gap-2 bg-amber-400 text-slate-950 font-black px-3.5 py-1.5 uppercase text-[10px] tracking-wider ${badgeStyle === "rounded" ? "rounded-xl" : "rounded-full"}`}>
                      {badgeText || "Flash Deal"}
                    </div>

                    <h2 style={{ color: textColor }} className="text-3xl sm:text-5xl font-extrabold leading-tight tracking-tight">
                      {currentBanner.title}
                    </h2>

                    {currentBanner.subtitle && (
                      <p style={{ color: textColor }} className="text-xs sm:text-base opacity-85 leading-relaxed font-medium max-w-lg">
                        {currentBanner.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 text-center gap-3">
                    <span className="text-[11px] font-bold uppercase tracking-widest opacity-80" style={{ color: textColor }}>
                      Special Offer
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-sm">
                      {highlightText || "Starting ₹499"}
                    </span>
                    {currentBanner.button_text && (
                      <Link
                        href={currentBanner.redirect_url || "/"}
                        onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                        className="w-full text-center bg-white text-slate-900 hover:bg-slate-100 font-extrabold text-xs uppercase tracking-wider py-3 px-6 rounded-xl shadow-lg transition-transform hover:scale-105"
                      >
                        {currentBanner.button_text}
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── TEMPLATE: SPLIT (Default) ─────────────────────────── */
              <motion.div
                key={`split-${currentBanner._id || currentBanner.id}`}
                initial={{ opacity: 0, x: 80 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                style={{ backgroundColor: bgColor }}
                className="absolute inset-0 w-full overflow-hidden rounded-[2rem] sm:rounded-[3rem] p-8 sm:p-14 text-white shadow-2xl flex items-center"
              >
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-400/10 blur-2xl" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center relative z-10 w-full">
                  <div className="flex flex-col gap-4 sm:gap-5 max-w-xl text-center md:text-left items-center md:items-start">
                    <div className={`flex items-center gap-2.5 bg-white/10 w-fit px-3.5 py-1.5 border border-white/10 backdrop-blur-sm ${badgeStyle === "rounded" ? "rounded-xl" : "rounded-full"}`}>
                      <ShieldCheck className="h-4 w-4" style={{ color: textColor }} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: textColor }}>
                        {badgeText || "Featured Offer"}
                      </span>
                    </div>

                    <h2 style={{ color: textColor }} className="text-2xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                      {currentBanner.title}
                    </h2>

                    {currentBanner.subtitle && (
                      <p style={{ color: textColor }} className="text-xs sm:text-base opacity-85 leading-relaxed font-medium">
                        {currentBanner.subtitle}
                      </p>
                    )}

                    {highlightText && (
                      <span className="px-3.5 py-1.5 bg-amber-400 text-slate-900 rounded-lg text-xs font-black">
                        {highlightText}
                      </span>
                    )}

                    {currentBanner.button_text && (
                      <div className="mt-2">
                        <Link
                          href={currentBanner.redirect_url || "/"}
                          onClick={(e) => handleBannerClick(e, currentBanner.redirect_url)}
                          className="relative overflow-hidden bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-bold uppercase tracking-[0.15em] px-7 sm:px-9 py-3.5 sm:py-4 rounded-xl shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2.5 group isolate"
                        >
                          {currentBanner.button_text}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {bannerImage && (
                    <div className="relative hidden md:flex justify-center items-center h-full">
                      <div className="h-64 w-64 md:h-[300px] md:w-[300px] rounded-[2.5rem] bg-black/20 backdrop-blur-2xl p-4 relative isolate overflow-hidden group border border-white/10 shadow-2xl">
                        <img
                          src={bannerImage}
                          alt={currentBanner.title || "Banner"}
                          className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Carousel Indicators if multiple banners in this slot */}
        {slotBanners.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {slotBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`transition-all duration-300 rounded-full ${
                  activeIndex === idx
                    ? "w-8 h-1.5 bg-[#1D2B83]"
                    : "w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
