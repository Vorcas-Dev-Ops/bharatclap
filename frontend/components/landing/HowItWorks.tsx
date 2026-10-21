"use client";

import React from "react";
import Link from "next/link";
import {
  Search,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Lock,
  DollarSign,
  Award,
} from "lucide-react";

interface StepItem {
  step: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  color: string;
  perks: string[];
}

const customerSteps: StepItem[] = [
  {
    step: "01",
    title: "Choose a Service",
    description: "Browse the services you need and select the right option.",
    icon: Search,
    color: "bg-blue-50 text-blue-700 border-blue-100",
    perks: ["Zero hidden charges", "Verified rating scores"],
  },
  {
    step: "02",
    title: "Pick a Time Slot",
    description: "Choose a convenient date and time for your service.",
    icon: Calendar,
    color: "bg-indigo-50 text-indigo-700 border-indigo-100",
    perks: ["Flexible scheduling", "Instant confirmation"],
  },
  {
    step: "03",
    title: "Verified Professional Arrives",
    description: "Your verified BharatClap professional arrives at the scheduled time.",
    icon: ShieldCheck,
    color: "bg-purple-50 text-purple-700 border-purple-100",
    perks: ["Aadhaar verified", "4-digit Start OTP safe"],
  },
  {
    step: "04",
    title: "Complete the Service & Pay",
    description: "Review the completed work and make your payment securely.",
    icon: CheckCircle2,
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    perks: ["30-day rework warranty", "UPI / Card / Cash"],
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-16 sm:py-24 border-y border-slate-100 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#1D2B83] bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100">
            Simple 4-Step Process
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
            How BharatClap Works
          </h2>
          <p className="text-sm sm:text-base text-slate-500 mt-2 font-normal">
            Book a trusted professional in just a few simple steps.
          </p>
        </div>

        {/* 4 Steps Progression Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {customerSteps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="relative bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-6 sm:p-7 border border-slate-200/80 hover:border-blue-200 transition-all duration-300 flex flex-col justify-between group shadow-sm hover:shadow-md"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-black text-slate-300 font-mono group-hover:text-blue-600 transition-colors">
                      {item.step}
                    </span>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${item.color} shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                  </div>

                  {/* Step Title & Description */}
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal mb-4">
                    {item.description}
                  </p>

                  {/* Mini Perks */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-200/60">
                    {item.perks.map((perk, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0" />
                        <span>{perk}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step Footer Indicator */}
                <div className="mt-5 pt-3 border-t border-slate-200/50 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span>Step {index + 1} of 4</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Safety & Trust Pillars Banner */}
        <div className="mt-12 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-100/80">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-xl bg-white text-blue-600 shadow-sm border border-blue-100 flex items-center justify-center mb-2">
                <ShieldCheck size={18} />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">Verified Pros</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Aadhaar & Police screened</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-xl bg-white text-indigo-600 shadow-sm border border-indigo-100 flex items-center justify-center mb-2">
                <Lock size={18} />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">4-Digit OTP</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Start job only when you confirm</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-xl bg-white text-violet-600 shadow-sm border border-violet-100 flex items-center justify-center mb-2">
                <DollarSign size={18} />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">Fixed Upfront Rates</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">No hidden charges or haggling</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-9 h-9 rounded-xl bg-white text-emerald-600 shadow-sm border border-emerald-100 flex items-center justify-center mb-2">
                <Award size={18} />
              </div>
              <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">30-Day Warranty</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Free revisit if not satisfied</p>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="mt-10 sm:mt-12 flex justify-center">
          <Link href="/services">
            <button className="px-8 py-3.5 rounded-xl bg-[#1D2B83] text-white font-extrabold text-xs sm:text-sm hover:bg-blue-900 shadow-lg shadow-blue-900/15 transition-all flex items-center justify-center gap-2 group">
              <span>Book a Service</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;
