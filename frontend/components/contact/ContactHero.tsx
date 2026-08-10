"use client";

import React from 'react';
import { PhoneCall, Clock } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';

const ContactHero = () => {
  const { platformName, supportPhone, supportStatus, workingHours } = useSettings();

  return (
    <section className="relative pt-12 pb-10 overflow-hidden bg-gradient-to-r from-[#1D2B83] to-[#2A3DA8] text-white">
      <div className="max-w-4xl mx-auto px-6 relative z-10 text-center space-y-4">
        
        {/* Support Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-wider mx-auto">
          <span className={`px-2 py-0.5 rounded-full text-[11px] ${supportStatus.bgColor} ${supportStatus.textColor}`}>
            {supportStatus.badge}
          </span>
          <span className="text-blue-200">• Response Time: {supportStatus.expectedResponseTime}</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
          We are here to assist you
        </h1>

        <p className="max-w-xl mx-auto text-blue-100 text-xs md:text-sm font-medium leading-relaxed">
          Need immediate support for an active booking or service inquiry on {platformName}? Speak directly with our customer care desk.
        </p>

        <div className="pt-2 flex flex-col items-center gap-2">
          <a
            href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-3 shadow-xl transition-transform active:scale-95"
          >
            <PhoneCall className="w-5 h-5" /> Call Support ({supportPhone})
          </a>
          <p className="text-[11px] text-blue-200 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-300" /> {workingHours}
          </p>
        </div>
      </div>
    </section>
  );
};

export default ContactHero;
