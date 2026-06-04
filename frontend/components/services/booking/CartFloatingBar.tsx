"use client";

import React from "react";
import { Clock, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CartFloatingBarProps {
  cart: Record<string, number>;
  totalAmount: number;
}

export const CartFloatingBar: React.FC<CartFloatingBarProps> = ({
  cart,
  totalAmount,
}) => {
  return (
    <AnimatePresence>
      {Object.keys(cart).length > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl lg:hidden"
        >
          <div className="bg-[#1D2B83] text-white p-5 sm:p-7 rounded-[36px] shadow-2xl shadow-[#1D2B83]/50 flex items-center justify-between border-3 border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center relative">
                <span className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-emerald-500 text-white text-[11px] font-black rounded-full flex items-center justify-center border-3 border-[#1D2B83]">
                  {Object.keys(cart).length}
                </span>
                <Clock className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">
                  Total Value
                </p>
                <p className="text-2xl font-black tracking-tighter">
                  ₹{totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
            <button className="bg-white text-[#1D2B83] px-8 py-4 rounded-[20px] font-black text-sm flex items-center gap-2.5 hover:bg-blue-50 transition-all shadow-xl active:scale-95 group">
              Checkout
              <ChevronRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
