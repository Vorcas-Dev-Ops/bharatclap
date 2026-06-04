"use client";

import React from "react";
import Image from "next/image";
import { Star, Clock, Plus, Minus, Search } from "lucide-react";
import { motion } from "framer-motion";

interface SubServiceData {
  id: string;
  title: string;
  rating: number;
  reviews: string;
  price: number;
  duration: string;
  description: string;
  image: string;
  features: string[];
}

interface SubServiceListProps {
  title: string;
  subServices: SubServiceData[];
  selectedSubServiceId?: string;
  onSelectSubService: (sub: SubServiceData) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  cart: Record<string, number>;
  loading: boolean;
  formatImageUrl: (url: string) => string;
}

export const SubServiceList: React.FC<SubServiceListProps> = ({
  subServices,
  selectedSubServiceId,
  onSelectSubService,
  onUpdateQuantity,
  cart,
  loading,
  formatImageUrl,
}) => {
  return (
    <div className="space-y-4 no-scrollbar scroll-smooth pb-10">
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 border border-gray-100 animate-pulse"
            >
              <div className="flex gap-6">
                <div className="flex-1 space-y-4">
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-20 bg-gray-100 rounded w-full" />
                </div>
                <div className="w-32 h-32 bg-gray-100 rounded-2xl" />
              </div>
            </div>
          ))}
        </div>
      ) : subServices.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-6 h-6 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            No services found
          </h3>
          <p className="text-sm font-medium text-gray-400 mt-2">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {subServices.map((sub) => (
            <motion.div
              key={sub.id}
              layoutId={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelectSubService(sub)}
              className={`bg-white rounded-3xl p-4 sm:p-5 border-2 transition-all cursor-pointer group hover:shadow-lg ${
                selectedSubServiceId === sub.id
                  ? "border-indigo-600 shadow-md ring-2 ring-indigo-600/10"
                  : "border-transparent shadow-sm hover:border-indigo-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                {/* Left Content */}
                <div className="flex-1 space-y-3 order-2 sm:order-1">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {sub.rating > 4.8 && (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-100">
                          Top Rated
                        </span>
                      )}
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {sub.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                        <span className="text-xs font-bold text-emerald-700">
                          {sub.rating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs font-medium text-gray-400">
                        {sub.reviews} reviews
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      {sub.duration}
                    </div>
                  </div>

                  <p className="text-sm font-medium text-gray-500 line-clamp-2 leading-relaxed">
                    {sub.description}
                  </p>

                  <div className="pt-2">
                    <span className="text-xl font-bold text-gray-900">
                      ₹{sub.price}
                    </span>
                  </div>
                </div>

                {/* Right Image & Button */}
                <div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-3 shrink-0 order-1 sm:order-2">
                  <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group-hover:scale-[1.02] transition-transform duration-500">
                    <Image
                      src={formatImageUrl(sub.image)}
                      alt={sub.title || "Sub-service Image"}
                      fill
                      sizes="(max-width: 640px) 96px, 128px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 sm:w-full">
                    {cart[sub.id] ? (
                      <button
                        className="w-full h-10 sm:h-11 px-4 sm:px-0 rounded-xl bg-indigo-600 text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider cursor-default"
                      >
                        ADDED
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateQuantity(sub.id, 1);
                        }}
                        className="w-full h-10 sm:h-11 px-4 sm:px-0 rounded-xl border-2 border-indigo-600 text-indigo-600 font-bold text-[10px] sm:text-xs hover:bg-indigo-600 hover:text-white transition-all active:scale-95 uppercase tracking-wider"
                      >
                        ADD
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};
