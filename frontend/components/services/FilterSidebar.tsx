"use client";

import React, { useState } from "react";
import { X, ChevronDown, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: {
    sortBy: string;
    minPrice: string;
    maxPrice: string;
    rating: string;
  }) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ isOpen, onClose, onApply }) => {
  const [sortBy, setSortBy] = useState("recommended");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("99999");
  const [rating, setRating] = useState("any");

  const sortOptions = [
    // { id: "recommended", label: "Recommended (Default)" },
    { id: "low-high", label: "Price: Low to High" },
    { id: "high-low", label: "Price: High to Low" },
    { id: "top-rated", label: "Top Rated" },
  ];

  const ratingOptions = [
    { id: "4", label: "4 & Up", stars: 4 },
    { id: "3", label: "3 & Up", stars: 3 },
    { id: "2", label: "2 & Up", stars: 2 },
    { id: "1", label: "1 & Up", stars: 1 },
    // { id: "any", label: "Any Rating", stars: 0 },
  ];

  const sidebarVariants = {
    closed: { x: "100%", transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
    open: { x: 0, transition: { type: "spring" as const, damping: 30, stiffness: 300 } },
  };

  const overlayVariants = {
    closed: { opacity: 0 },
    open: { opacity: 1 },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[100]"
          />

          {/* Sidebar */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebarVariants}
            className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-white shadow-2xl z-[101] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Filters</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content Swiper Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {/* Sort By Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Sort By</h3>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-3">
                  {sortOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="sortBy"
                          value={option.id}
                          checked={sortBy === option.id}
                          onChange={() => setSortBy(option.id)}
                          className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-full checked:border-[#3B82F6] transition-all"
                        />
                        <div className="absolute w-2.5 h-2.5 bg-[#3B82F6] rounded-full scale-0 peer-checked:scale-100 transition-transform" />
                      </div>
                      <span className={`text-sm font-medium transition-colors ${sortBy === option.id ? 'text-slate-900 font-bold' : 'text-slate-500 group-hover:text-slate-700'}`}>
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Price Range</h3>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Min Price</label>
                    <input
                      type="number"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-[#3B82F6]/30 transition-all"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Max Price</label>
                    <input
                      type="number"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-[#3B82F6]/30 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Rating Section */}
              <div className="space-y-4 pb-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Rating</h3>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-3">
                  {ratingOptions.map((option) => (
                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="radio"
                          name="rating"
                          value={option.id}
                          checked={rating === option.id}
                          onChange={() => setRating(option.id)}
                          className="peer appearance-none w-5 h-5 border-2 border-slate-200 rounded-full checked:border-[#3B82F6] transition-all"
                        />
                        <div className="absolute w-2.5 h-2.5 bg-[#3B82F6] rounded-full scale-0 peer-checked:scale-100 transition-transform" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${
                                i < option.stars ? "text-yellow-400 fill-yellow-400" : "text-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${rating === option.id ? 'text-slate-900 font-bold' : 'text-slate-500 group-hover:text-slate-700'}`}>
                          {option.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex gap-4 bg-white">
              <button
                onClick={() => {
                  setSortBy("recommended");
                  setMinPrice("0");
                  setMaxPrice("99999999");
                  setRating("any");
                }}
                className="flex-1 py-4 px-6 border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  onApply({ sortBy, minPrice, maxPrice, rating });
                  onClose();
                }}
                className="flex-[2] py-4 px-6 bg-[#3B82F6] text-white rounded-2xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilterSidebar;
