"use client";

import React from 'react';
import { Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface CategorySelectCardProps {
  category: any;
  onClick?: () => void;
}

const CategorySelectCard: React.FC<CategorySelectCardProps> = ({ category, onClick }) => {
  return (
    <motion.div 
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ 
        y: -8, 
        scale: 1.05,
        boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)"
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="bg-white rounded-[2rem] p-4 py-8 shadow-sm hover:border-blue-200 transition-colors duration-300 flex flex-col items-center justify-center text-center cursor-pointer group border border-gray-50 scale-[0.98]"
    >
      {/* Icon Container - Compact & Animated */}
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5 group-hover:bg-blue-600 transition-all duration-500 overflow-hidden shadow-inner relative">
         <motion.div 
            className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
         />
        {category.icon && category.icon.startsWith('http') ? (
          <motion.img 
            src={category.icon} 
            alt={category.category_name} 
            className="w-10 h-10 object-contain relative z-10 group-hover:brightness-0 group-hover:invert transition-all duration-500" 
          />
        ) : (
          <Layers 
            size={24} 
            className="text-gray-300 group-hover:text-white transition-colors duration-500 relative z-10" 
            strokeWidth={1.5} 
          />
        )}
      </div>

      {/* Category Name - Refined Typography */}
      <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-[0.2em] leading-tight transition-colors group-hover:text-blue-600">
        {category.category_name}
      </h3>
      
      {/* Animated underline indicator */}
      <motion.div 
        className="mt-3 h-0.5 w-0 bg-blue-600 rounded-full"
        animate={{ width: 0 }}
        whileHover={{ width: 24 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};

export default CategorySelectCard;
