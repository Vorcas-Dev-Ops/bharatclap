"use client";

import React from "react";
import { motion } from "framer-motion";
import { Zap, Droplets, Wind, Hammer, Paintbrush, Layers, ChevronRight, Users } from "lucide-react";

interface CategoryCardProps {
  category: any;
  onClick: () => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  electrical: <Zap size={22} />,
  plumbing: <Droplets size={22} />,
  ac: <Wind size={22} />,
  carpentry: <Hammer size={22} />,
  painting: <Paintbrush size={22} />,
};

const getIcon = (name: string) => {
  const key = name?.toLowerCase();
  for (const k in ICON_MAP) {
    if (key?.includes(k)) return ICON_MAP[k];
  }
  return <Layers size={22} />;
};

export default function CategoryCard({ category, onClick }: CategoryCardProps) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group w-full text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
        {category.image ? (
          <img
            src={category.image}
            alt={category.category_name}
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          getIcon(category.category_name)
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-black text-gray-900 text-sm tracking-tight truncate">
            {category.category_name}
          </p>
          {category.requiresGenderSelection && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-50 border border-purple-100 text-purple-600 rounded-md text-[7px] font-black tracking-widest uppercase">
              <Users size={7} /> Gender
            </span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 font-medium mt-0.5 line-clamp-1">
          {category.description || "Tap to manage services"}
        </p>
        <div className="mt-1.5 flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${category.status === "active" ? "bg-green-500" : "bg-red-400"}`}
          />
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
            {category.status || "active"}
          </span>
        </div>
      </div>

      <ChevronRight
        size={16}
        className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all shrink-0"
      />
    </motion.button>
  );
}
