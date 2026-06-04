"use client";

import React from "react";
import { Search, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface ServiceSearchHeaderProps {
  title: string;
  optionsCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cartItemCount?: number;
}

export const ServiceSearchHeader: React.FC<ServiceSearchHeaderProps> = ({
  title,
  optionsCount,
  searchQuery,
  setSearchQuery,
  cartItemCount = 0,
}) => {
  return (
    <div className="z-40">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 pb-6 sm:pb-8 space-y-6 sm:space-y-8">
        {/* Row 1: Centered Title */}
        <div className="text-center">
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            {title || "Services"}
          </h1>
        </div>

        {/* Row 2: Search Bar & Cart Button */}
        <div className="flex items-center justify-between gap-4 sm:gap-6 max-w-5xl mx-auto">
          {/* Left: Search Bar */}
          <div className="relative flex-1 h-12 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search in ${title}...`}
              className="w-full h-full pl-12 pr-4 bg-transparent focus:outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};