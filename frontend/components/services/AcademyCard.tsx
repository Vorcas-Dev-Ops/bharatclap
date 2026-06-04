"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { Button } from "antd";
import { motion } from "framer-motion";

interface AcademyCardProps {
  title: string;
  category: string;
  description: string;
  price: string;
  icon?: React.ReactNode;
}

const AcademyCard: React.FC<AcademyCardProps> = ({
  title,
  category,
  description,
  price,
  icon,
}) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all hover:shadow-xl"
    >
      {/* Icon */}
      <div className="w-10 h-10 bg-[#F5F2FB] rounded-xl flex items-center justify-center mb-6">
        {icon || <BookOpen className="w-5 h-5 text-[#6D28D9]" />}
      </div>

      {/* Content */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-1">{title}</h3>
        <p className="text-xs font-semibold text-[#6D28D9] mb-4 uppercase tracking-wider">{category}</p>
        <p className="text-sm text-slate-400 leading-relaxed font-medium">
          {description}
        </p>
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
        <div className="flex flex-col">
          <span className="text-2xl font-black text-slate-800 tracking-tight">{price}</span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">per session</span>
        </div>
        <Button 
          ghost 
          className="border-[#6D28D9] text-[#6D28D9] font-bold h-10 px-8 rounded-xl hover:bg-[#F5F2FB] hover:text-[#5B21B6] border-2 uppercase text-xs tracking-widest"
        >
          BOOK
        </Button>
      </div>
    </motion.div>
  );
};

export default AcademyCard;
