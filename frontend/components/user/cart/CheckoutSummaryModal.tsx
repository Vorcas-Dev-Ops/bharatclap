"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard, 
  ChevronRight,
  ShieldCheck,
  Receipt,
  Info
} from "lucide-react";

interface CheckoutSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: any;
  address: any;
  date: "today" | "tomorrow";
  slot: string | null;
  paymentMethod: "online" | "cod";
  platformFee: number;
  discount: number;
  totalAmount: number;
  finalTotal: number;
  onConfirm: () => void;
  loading?: boolean;
}

export default function CheckoutSummaryModal({
  isOpen,
  onClose,
  cart,
  address,
  date,
  slot,
  paymentMethod,
  platformFee,
  discount,
  totalAmount,
  finalTotal,
  onConfirm,
  loading = false
}: CheckoutSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Booking Summary</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Final Review before booking</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-white rounded-full transition-all shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              
              {/* Address Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <MapPin className="w-3 h-3" /> Service Address
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-800">
                    {address?.address_label && (
                      <span className="inline-flex items-center text-[#1D2B83] font-black text-[10px] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full mr-2">
                        {address.address_label}
                      </span>
                    )}
                    {address?.house_name || address?.address_line}
                    {address?.building_name ? `, ${address.building_name}` : ''}
                  </p>
                  {(address?.street || address?.area) && (
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {[address.street, address.area].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{address?.city}, {address?.state} - {address?.pincode}</p>
                </div>
              </div>

              {/* Schedule Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Calendar className="w-3 h-3" /> Date
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 capitalize">
                      {date && date !== "today" && date !== "tomorrow" 
                        ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : date}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Clock className="w-3 h-3" /> Time Slot
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{slot}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <CreditCard className="w-3 h-3" /> Payment Method
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    {paymentMethod === "online" ? "Pay Online" : "Pay after service (COD)"}
                  </span>
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                   Service Items
                </div>
                <div className="space-y-2">
                  {cart?.items?.map((item: any, idx: number) => {
                    const price = item.price_snapshot || 0;
                    const quantity = item.quantity || 1;
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 font-bold">
                          {item.subservice_id?.subservice_name} 
                          <span className="ml-2 text-[10px] text-slate-400 font-black tracking-widest">×{quantity}</span>
                        </span>
                        <span className="text-slate-800 font-black">₹{price * quantity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Final Bill */}
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold">Items Subtotal</span>
                  <span className="text-slate-600 font-bold">₹{totalAmount}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-bold">Platform Fee</span>
                  <span className="text-slate-600 font-bold">₹{platformFee}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between items-center text-sm text-green-600">
                    <span className="font-bold">Discount</span>
                    <span className="font-bold">-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 mt-2 border-t border-slate-50">
                  <span className="text-lg font-black text-slate-800 uppercase tracking-tighter">Amount to Pay</span>
                  <span className="text-2xl font-black text-[#1D2B83]">₹{finalTotal}</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="w-full h-16 bg-[#1D2B83] text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Confirm & Book Now"}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
              
              <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                Secure Checkout Powered by Fixvo
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
