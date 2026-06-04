"use client";

import React from "react";
import Image from "next/image";
import { Star, Plus, Minus } from "lucide-react";
import { motion } from "framer-motion";

interface BookingServiceCardProps {
  id: string;
  title: string;
  rating: number;
  reviews: string;
  price: number;
  description: string;
  image: string;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
}

const BookingServiceCard: React.FC<BookingServiceCardProps> = ({
  title,
  rating,
  reviews,
  price,
  description,
  image,
  quantity,
  onAdd,
  onRemove,
}) => {
  return (
    <div className="bg-white rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex flex-col md:flex-row gap-6 sm:gap-8">
        {/* Left Side: Content */}
        <div className="flex-1 space-y-3 sm:space-y-4">
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
            {title}
          </h3>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#F8F9FA] px-2 py-1 rounded-md">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-bold text-slate-700">{rating}</span>
            </div>
            <span className="text-xs font-bold text-slate-400">· {reviews} reviews</span>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 tracking-wider">Starts at</span>
            <span className="text-lg sm:text-xl font-black text-slate-800">₹{price}</span>
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-500 leading-relaxed max-w-lg">
            {description}
          </p>

          <button className="text-xs font-black text-[#1D2B83] hover:underline flex items-center gap-1 pt-2">
            View details
            <span className="text-lg">→</span>
          </button>
        </div>

        {/* Right Side: Image & Action */}
        <div className="relative w-full md:w-48 flex flex-col items-center gap-4">
          <div className="relative w-48 h-48 rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all">
            <Image
              src={image}
              alt={title || "Service image"}
              fill
              sizes="(max-width: 768px) 100vw, 192px"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
          </div>

          <div className="absolute -bottom-4 bg-white rounded-xl shadow-lg border border-slate-100 px-4 py-2 min-w-[100px] flex items-center justify-between gap-3">
            {quantity > 0 ? (
              <>
                <button
                  onClick={onRemove}
                  className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <Minus className="w-3.5 h-3.5 text-[#1D2B83] stroke-[3]" />
                </button>
                <span className="text-sm font-black text-[#1D2B83]">{quantity}</span>
                <button
                  onClick={onAdd}
                  className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#1D2B83] stroke-[3]" />
                </button>
              </>
            ) : (
              <button
                onClick={onAdd}
                className="w-full text-sm font-black text-[#1D2B83] py-0.5 tracking-widest"
              >
                Add
              </button>
            )}
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-4">
            {quantity > 0 ? "Add more" : "6 options available"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BookingServiceCard;
