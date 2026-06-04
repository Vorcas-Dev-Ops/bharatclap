"use client";

import React from "react";
import Image from "next/image";
import { Star, Plus, Minus, ShoppingCart } from "lucide-react";
import { Button } from "antd";
import { motion } from "framer-motion";
import Link from "next/link";

interface ServiceCardProps {
  id: string;
  subserviceId?: string;
  image: string;
  title: string;
  rating: number;
  price: string;
  category?: string;
  onAddToCart?: (subserviceId: string, delta: number) => void;
  cartQuantity?: number;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  id,
  subserviceId,
  image,
  title,
  rating,
  price,
  onAddToCart,
  cartQuantity = 0,
}) => {
  const href = subserviceId ? `/service/${id}?subservice=${subserviceId}` : `/service/${id}`;

  const handleAddClick = (e: React.MouseEvent) => {
    if (onAddToCart && subserviceId) {
      e.preventDefault();
      e.stopPropagation();
      onAddToCart(subserviceId, 1);
    }
  };

  const handleUpdateQty = (e: React.MouseEvent, delta: number) => {
    if (onAddToCart && subserviceId) {
      e.preventDefault();
      e.stopPropagation();
      onAddToCart(subserviceId, delta);
    }
  };

  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -5 }}
        className="w-full bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 transition-all hover:shadow-xl group h-full flex flex-col"
      >
        {/* Image Section */}
        <div className="relative h-48 w-full overflow-hidden">
          <Image
            src={image}
            alt={title || "Service image"}
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-bold text-slate-700">{rating.toFixed(1)}</span>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-lg font-bold text-slate-800 mb-2 truncate">
            {title}
          </h3>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1">
              <span className="text-sm text-[#1D2B83] font-black">{price}</span>
            </div>
          </div>

          <div className="mt-auto">
            {onAddToCart && subserviceId ? (
              cartQuantity > 0 ? (
                <div className="flex items-center justify-between bg-slate-50 p-1 rounded-xl border border-slate-100">
                  <button
                    onClick={(e) => handleUpdateQty(e, -1)}
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#1D2B83] hover:bg-blue-50 transition-colors"
                  >
                    <Minus size={14} strokeWidth={3} />
                  </button>
                  <span className="font-black text-slate-800 text-sm">{cartQuantity}</span>
                  <button
                    onClick={(e) => handleUpdateQty(e, 1)}
                    className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#1D2B83] hover:bg-blue-50 transition-colors"
                  >
                    <Plus size={14} strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <Button
                  onClick={handleAddClick}
                  type="primary"
                  className="w-full bg-white border-2 border-[#1D2B83] text-[#1D2B83] hover:bg-[#1D2B83] hover:text-white h-10 rounded-xl font-black text-[10px] tracking-widest transition-all duration-300 flex items-center justify-center gap-2"
                >
                  ADD TO CART
                </Button>
              )
            ) : (
              <Button
                type="primary"
                className="w-full bg-[#1D2B83] hover:bg-[#151f63] h-10 rounded-xl font-bold text-xs tracking-widest transition-all duration-300 border-none"
              >
                BOOK NOW
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

export default ServiceCard;
