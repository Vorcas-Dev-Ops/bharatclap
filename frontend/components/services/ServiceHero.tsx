

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import FilterSidebar from "./FilterSidebar";



interface ServiceHeroProps {
  onSearch: (query: string) => void;
  onApplyFilters: (filters: {
    sortBy: string;
    minPrice: string;
    maxPrice: string;
    rating: string;
  }) => void;
}

const ServiceHero: React.FC<ServiceHeroProps> = ({
  onSearch,
  onApplyFilters
}) => {
  const [selected, setSelected] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <section className="pt-14 pb-12">
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <h1 className="text-[40px] sm:text-[50px] font-black text-[#1D2B83] leading-none mb-10 tracking-tight text-center">
          All Services
        </h1>

        {/* Search and Filters Bar */}
        <div className="flex items-center justify-between gap-4 mb-8">
          {/* Search Input (Left Side) */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search services..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full bg-white rounded-full py-3 pl-11 pr-6 text-xs font-medium text-slate-700 outline-none border border-slate-200 focus:border-[#1D2B83] transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>

          {/* Filter Button (Right Side) */}
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-2 bg-white px-6 py-3 rounded-full border border-slate-200 hover:border-[#1D2B83] shadow-sm transition-all flex-shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#1D2B83]" />
            <span className="text-xs font-bold text-[#1D2B83]">Filters</span>
          </motion.button>
        </div>
      </div>

      {/* Filter Sidebar Component */}
      <FilterSidebar
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={onApplyFilters}
      />
    </section>
  );
};

export default ServiceHero;
