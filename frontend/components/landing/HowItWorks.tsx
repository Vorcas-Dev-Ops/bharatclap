"use client";

import React from "react";
import { Wrench, Calendar, UserCheck, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    id: 1,
    title: "Select Service",
    description: "Browse and choose what you need from our platform.",
    icon: Wrench,
  },
  {
    id: 2,
    title: "Book Slot",
    description: "Pick a date & time that best suits your schedule.",
    icon: Calendar,
  },
  {
    id: 3,
    title: "Technician Arrives",
    description: "A verified expert reaches your place as scheduled.",
    icon: UserCheck,
  },
  {
    id: 4,
    title: "Service Done",
    description: "Relax while our professionals get the job done right.",
    icon: CheckCircle2,
  },
];

const HowItWorks = () => {
  return (
    <section 
      style={{ background: "linear-gradient(135deg, #0f1b3d, #1e3a8a)" }}
      className="py-16 sm:py-24 text-white overflow-hidden relative isolate"
    >
      {/* Background Decorative Blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -z-10 h-96 w-96 rounded-full bg-blue-500/10 blur-[100px]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-5xl font-extrabold tracking-tight mb-4">
            How It Works
          </h2>
          <p className="text-slate-400 text-sm sm:text-lg max-w-2xl mx-auto">
            Get your home services done in four simple and transparent steps.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
          
          {/* Connection Line (Desktop) - Perfectly centered through the card bodies */}
          <div className="hidden md:block absolute top-1/2 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 -z-10 shadow-[0_0_10px_rgba(37,99,235,0.3)]" />

          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative flex flex-col items-center text-center group h-full"
              >
                {/* Step Number Badge */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-600 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] z-20 group-hover:scale-110 transition-transform duration-300">
                  {step.id}
                </div>

                {/* Card Container with glass effect */}
                <div className="w-full bg-white/5 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] backdrop-blur-xl border border-white/10 transition-all duration-300 group-hover:bg-white/[0.08] group-hover:border-white/20 group-hover:-translate-y-2 group-hover:shadow-2xl group-hover:shadow-blue-900/20 h-full">
                  
                  {/* Icon Circle */}
                  <div className="mb-6 sm:mb-8 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-3xl bg-blue-500/10 text-blue-400 mx-auto transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={1.5} />
                  </div>
                  
                  {/* Text Content */}
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
