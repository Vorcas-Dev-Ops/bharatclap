"use client";

import React from "react";
import Image from "next/image";
import { Check, Info } from "lucide-react";
import { Button } from "antd";
import { motion } from "framer-motion";

interface FeaturedServiceCardProps {
  image: string;
  title: string;
  category: string;
  description: string;
  features: string[];
  ctaText: string;
  badge?: string;
}

const FeaturedServiceCard: React.FC<FeaturedServiceCardProps> = ({
  image,
  title,
  category,
  description,
  features,
  ctaText,
  badge,
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl flex flex-col md:flex-row gap-6 sm:gap-8 items-center"
    >
      {/* Image Section */}
      <div className="relative w-full md:w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0">
        <Image
          src={image}
          alt={title || "Featured service image"}
          fill
          sizes="(max-width: 768px) 100vw, 192px"
          className="object-cover"
        />
      </div>

      {/* Content Section */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold text-[#1D2B83] uppercase tracking-[0.2em] bg-[#F5F2FB] px-3 py-1 rounded-full">
            {badge || category}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-xs sm:text-sm text-slate-400 font-medium mb-6 leading-relaxed">
          {description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 mb-8">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#1D2B83] rounded-full flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold text-slate-700">{feature}</span>
            </div>
          ))}
        </div>

        <Button 
          type="primary" 
          icon={<Info className="w-3.5 h-3.5" />}
          className="bg-[#1D2B83] hover:bg-[#151f63] h-10 px-8 rounded-xl font-bold text-xs tracking-widest transition-all duration-300 border-none flex items-center gap-2"
        >
          {ctaText}
        </Button>
      </div>
    </motion.div>
  );
};

export default FeaturedServiceCard;
