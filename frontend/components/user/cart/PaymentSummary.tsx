"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { Tag as AntTag, message } from "antd";
import type { MessageInstance } from "antd/es/message/interface";

const Gift = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 12 20 22 4 22 4 12"></polyline>
    <rect x="2" y="7" width="20" height="5"></rect>
    <line x1="12" y1="22" x2="12" y2="7"></line>
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
  </svg>
);

interface PaymentSummaryProps {
  totalAmount: number;
  platformFee: number;
  discount: number;
  finalTotal: number;
  couponCode: string;
  setCouponCode: (code: string) => void;
  handleCheckout: () => void;
  messageApi: MessageInstance;
}

export default function PaymentSummary({
  totalAmount,
  platformFee,
  discount,
  finalTotal,
  couponCode,
  setCouponCode,
  handleCheckout,
  messageApi
}: PaymentSummaryProps) {
  return (
    <div className="lg:col-span-4 lg:sticky lg:top-28 space-y-6">
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/50">
        <h3 className="text-lg font-black text-slate-800 mb-6">Payment Summary</h3>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-400">Items Total</span>
            <span className="font-black text-slate-800">₹{totalAmount}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="font-bold text-slate-400">Platform Fee</span>
            <span className="font-black text-slate-800">₹{platformFee}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between items-center text-sm text-emerald-600">
              <span className="font-bold">Discount Applied</span>
              <span className="font-black">-₹{discount}</span>
            </div>
          )}
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-lg font-black text-slate-800">Grand Total</span>
            <span className="text-2xl font-black text-[#1D2B83]">₹{finalTotal}</span>
          </div>
        </div>

        {/* Coupon Code */}
        <div className="relative mb-8">
          <AntTag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 border-none bg-transparent" />
          <input 
            type="text"
            placeholder="Coupon Code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="w-full h-14 pl-12 pr-28 bg-slate-50 border border-transparent focus:border-[#1D2B83]/20 focus:bg-white rounded-2xl outline-none transition-all text-sm font-bold text-slate-700"
          />
          <button 
            onClick={() => couponCode === "FIXVO50" ? messageApi.success("Promo code applied!") : messageApi.error("Invalid promo code")}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-colors"
          >
            Apply
          </button>
        </div>

        <button 
          onClick={handleCheckout}
          className="w-full h-16 bg-[#1D2B83] hover:bg-blue-800 text-white font-black uppercase tracking-[0.2em] rounded-[1.25rem] shadow-2xl shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
        >
          Proceed to Checkout
          <ChevronRight className="w-5 h-5" />
        </button>
        
        <p className="text-[10px] font-bold text-slate-400 text-center mt-6 uppercase tracking-widest">
          Safe & Secure Payments
        </p>
      </div>

      {/* Savings Tip */}
      {discount > 0 && (
        <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
            <Gift className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-black text-emerald-900">Saving ₹{discount} on this order!</h4>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Promo {couponCode} applied</p>
          </div>
        </div>
      )}
    </div>
  );
}
