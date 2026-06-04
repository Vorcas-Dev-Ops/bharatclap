"use client";

import React from "react";
import { ShieldCheck, Clock, CircleDollarSign, Lock } from "lucide-react";
import { motion } from "framer-motion";

const trustFeatures = [
  {
    title: "Verified Technicians",
    description: "Every professional is background-checked and skill-verified to ensure quality.",
    icon: ShieldCheck,
  },
  {
    title: "On-Time Service",
    description: "We value your time. Our technicians arrive exactly as scheduled for every task.",
    icon: Clock,
  },
  {
    title: "Transparent Pricing",
    description: "Know exactly what you'll pay before you book. No hidden fees or surprise charges.",
    icon: CircleDollarSign,
  },
  {
    title: "Safe & Secure",
    description: "Your safety and security are our top priorities throughout the service journey.",
    icon: Lock,
  },
];

const TrustSection = () => {
  return (
    <section className="bg-[#F5F2FB] py-12 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-20"
        >
          <h2 className="text-2xl sm:text-4xl font-bold text-[#171717]">
            Why Choose Us
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="h-1 w-16 bg-[#1D2B83] rounded-full mx-auto mt-4 origin-left"
          />
        </motion.div>

        {/* 4 Cards Grid - Responsive columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 sm:gap-x-12 gap-y-12 sm:gap-y-16">
          {trustFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12, type: "spring", bounce: 0.45 }}
                className="flex flex-col items-center sm:items-start text-center sm:text-left group"
              >
                {/* Bouncing Icon Box */}
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.12 + 0.2, type: "spring", bounce: 0.6 }}
                  whileHover={{ scale: 1.15, rotate: 6, y: -4 }}
                  className="mb-6 sm:mb-8 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#E0E7FF] text-[#1D2B83] cursor-default"
                >
                  <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
                </motion.div>
                
                {/* Content */}
                <h3 className="mb-3 sm:mb-4 text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-xs sm:text-base text-slate-500 leading-relaxed max-w-[260px]">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
