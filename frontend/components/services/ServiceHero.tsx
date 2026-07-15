

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import FilterSidebar from "./FilterSidebar";

interface ServiceHeroProps {
  onSearch: (query: string) => void;
  onApplyFilters: (filters: {
    sortBy: string;
    minPrice: string;
    maxPrice: string;
    rating: string;
  }) => void;
  categories: Array<{ id: string; name: string; slug: string; icon?: string }>;
  activeCategory: string;
  onCategorySelect: (slug: string) => void;
}

const ServiceHero: React.FC<ServiceHeroProps> = ({
  onSearch,
  onApplyFilters,
  categories,
  activeCategory,
  onCategorySelect
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 5);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    const timer = setTimeout(checkScroll, 50);

    const container = scrollRef.current;
    if (container) {
      container.addEventListener("scroll", checkScroll);
    }
    window.addEventListener("resize", checkScroll);

    return () => {
      clearTimeout(timer);
      if (container) {
        container.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("resize", checkScroll);
    };
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 250;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth"
      });
    }
  };

  return (
    <section className="pt-2  pb-2">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-[40px] sm:text-[50px] font-black text-[#1D2B83] leading-none mb-10 tracking-tight text-center">
          All Services
        </h1>

        {/* Search and Filters Bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
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

        {/* Categories Horizontally Scrollable Bar */}
        {categories && categories.length > 0 && (
          <div className="w-full mt-4 mb-1 border-b border-slate-100 pb-3">
            <div className="relative flex items-center">
              {/* Left Arrow Button */}
              {showLeftArrow && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center pr-12 pl-1 bg-gradient-to-r from-[#FCF8FF] via-[#FCF8FF]/95 to-transparent z-10 h-12 pointer-events-none -ml-4 sm:ml-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => scroll("left")}
                    className="w-8 h-8 rounded-full border border-slate-200 bg-white shadow-md flex items-center justify-center cursor-pointer pointer-events-auto text-[#1D2B83] hover:bg-slate-50 hover:border-[#1D2B83]/40 transition-all shadow-sm"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4.5 h-4.5 stroke-[2.5]" />
                  </motion.button>
                </div>
              )}

              {/* Scrollable Container */}
              <div
                ref={scrollRef}
                className="flex-1 flex items-center gap-3 overflow-x-auto py-2 px-1 scrollbar-none -mx-4 sm:mx-0 sm:px-0 scroll-smooth select-none"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                <style dangerouslySetInnerHTML={{
                  __html: `
                  .scrollbar-none::-webkit-scrollbar {
                    display: none;
                  }
                `}} />

                {/* 'All Services' Tab */}
                <motion.button
                  whileHover={{ y: -1, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onCategorySelect("all")}
                  className={`flex items-center justify-center px-5 py-2.5 rounded-full text-xs font-black transition-all border duration-300 whitespace-nowrap cursor-pointer shadow-sm ${activeCategory === "all"
                      ? "bg-[#1D2B83] text-white border-[#1D2B83] shadow-md shadow-[#1D2B83]/20"
                      : "bg-white text-slate-600 border-slate-200 hover:border-[#1D2B83] hover:text-[#1D2B83]"
                    }`}
                >
                  All Services
                </motion.button>

                {/* Dynamic Categories */}
                {categories.map((category) => {
                  const isActive = activeCategory === category.slug;
                  return (
                    <motion.button
                      key={category.id}
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onCategorySelect(category.slug)}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs font-black transition-all border duration-300 whitespace-nowrap cursor-pointer shadow-sm ${isActive
                          ? "bg-[#1D2B83] text-white border-[#1D2B83] shadow-md shadow-[#1D2B83]/20"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[#1D2B83] hover:text-[#1D2B83]"
                        }`}
                    >
                      {category.icon && (
                        <img
                          src={category.icon}
                          alt={category.name}
                          className={`w-4.5 h-4.5 object-contain transition-all duration-300 ${isActive ? "brightness-0 invert" : "opacity-85"
                            }`}
                        />
                      )}
                      <span>{category.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Right Arrow Button */}
              {showRightArrow && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center pl-12 pr-1 bg-gradient-to-l from-[#FCF8FF] via-[#FCF8FF]/95 to-transparent z-10 h-12 pointer-events-none -mr-4 sm:mr-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => scroll("right")}
                    className="w-8 h-8 rounded-full border border-slate-200 bg-white shadow-md flex items-center justify-center cursor-pointer pointer-events-auto text-[#1D2B83] hover:bg-slate-50 hover:border-[#1D2B83]/40 transition-all shadow-sm"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4.5 h-4.5 stroke-[2.5]" />
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        )}
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
