"use client";

import React from 'react';
import { LucideIcon, Pencil, ChevronRight, LayoutList, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface CategoryCardProps {
  category: any;
  onClick?: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onClick }) => {
  return (
    <motion.div 
      onClick={onClick}
      className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden cursor-pointer"
    >
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 bg-blue-500`} />
      
      <div className="flex items-start justify-between relative z-10">
        <div className={`w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shadow-sm group-hover:rotate-12 transition-transform duration-500 overflow-hidden`}>
          {category.icon && category.icon.startsWith('http') ? (
            <img src={category.icon} alt={category.category_name} className="w-full h-full object-cover" />
          ) : (
            <Layers size={18} className="text-gray-500" strokeWidth={2.5} />
          )}
        </div>
      </div>

      <div className="mt-4 relative z-10">
        <h3 className="text-xs font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase tracking-widest leading-tight line-clamp-1">{category.category_name}</h3>
        <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed opacity-70">
            {category.description || 'Manage domain services and catalog'}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between opacity-60 group-hover:opacity-100 transition-opacity">
         <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50/50 text-blue-600 rounded-lg text-[7px] font-black uppercase tracking-widest border border-blue-100/30">
            <LayoutList size={10} />
            Registry
         </div>
         <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 group-hover:translate-x-1 transition-transform">
            View Catalog <ChevronRight size={10} />
         </div>
      </div>
    </motion.div>
  );
};

export default CategoryCard;
