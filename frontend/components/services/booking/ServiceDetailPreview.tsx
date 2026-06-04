"use client";

import React from "react";
import Image from "next/image";
import { Star, Clock, CheckCircle2, Info, Minus, Plus, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

interface ServiceDetailPreviewProps {
  selectedSubService: SubServiceData | null;
  cart: Record<string, number>;
  onUpdateQuantity: (id: string, delta: number) => void;
  formatImageUrl: (url: string) => string;
}

export const ServiceDetailPreview: React.FC<ServiceDetailPreviewProps> = ({
  selectedSubService,
  cart,
  onUpdateQuantity,
  formatImageUrl,
}) => {
  return (
    <aside className="w-full">
      <AnimatePresence mode="wait">
        {selectedSubService ? (
          <motion.div
            key={selectedSubService.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden"
          >
            {/* Banner */}
            <div className="relative h-56 w-full">
              <Image
                src={formatImageUrl(selectedSubService.image)}
                alt={selectedSubService.title || "Service Image"}
                fill
                sizes="(max-width: 768px) 100vw, 400px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {selectedSubService.title}
                </h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Core Info */}
              <div className="flex items-center gap-6 pb-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedSubService.rating.toFixed(1)}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      {selectedSubService.reviews} Reviews
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {selectedSubService.duration}
                    </p>
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                      Duration
                    </p>
                  </div>
                </div>
              </div>

              {/* What's included */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  What's included
                </h4>
                <ul className="space-y-3">
                  {selectedSubService.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-gray-600">
                        {feature}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-gray-100" />

              {/* Description */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  About this service
                </h4>
                <p className="text-sm font-medium text-gray-500 leading-relaxed">
                  {selectedSubService.description}
                </p>
              </div>

              {/* Action Bar */}
              <div className="pt-6 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Final Price
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      ₹{selectedSubService.price}
                    </p>
                  </div>
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                    Available Today
                  </div>
                </div>

                {cart[selectedSubService.id] ? (
                  <button
                    className="w-full h-14 bg-indigo-600 text-white font-bold rounded-2xl cursor-default flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    ADDED TO BOOKINGS
                  </button>
                ) : (
                  <button
                    onClick={() => onUpdateQuantity(selectedSubService.id, 1)}
                    className="w-full h-14 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                  >
                    Add to Bookings
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 p-10 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Info className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Service Details</h3>
            <p className="text-sm font-medium text-gray-400 mt-2 max-w-xs">
              Select a service to see what's included and its features.
            </p>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
};
