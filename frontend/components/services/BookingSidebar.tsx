"use client";

import React from "react";
import { ShieldCheck, Info, CheckCircle2, ChevronRight, Minus, Plus } from "lucide-react";

interface CartItem {
  id: string;
  title: string;
  quantity: number;
  price: number;
}

interface BookingSidebarProps {
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
}

const BookingSidebar: React.FC<BookingSidebarProps> = ({ cartItems, onUpdateQuantity }) => {
  const totalAmount = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <div className="space-y-6 sticky top-32">
      {/* Promo Section */}
      <div className="bg-[#EEF1FF] rounded-3xl p-6 border border-[#DCE4FF] flex items-start gap-4 shadow-sm">
        <div className="bg-white p-2.5 rounded-xl shadow-sm">
          <ShieldCheck className="w-6 h-6 text-[#1D2B83]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-[13px] font-black text-slate-800 tracking-tight">
            Get visitation fee off
          </h4>
          <p className="text-[11px] font-bold text-slate-500">
            Applicable on bookings above ₹99
          </p>
          <div className="flex items-center gap-2 pt-2">
            <div className="bg-white border-2 border-dashed border-slate-200 px-3 py-1.5 rounded-lg">
              <span className="text-[10px] font-black tracking-widest text-[#1D2B83]">SANCTUARY20</span>
            </div>
            <button className="text-[10px] font-black text-[#1D2B83] hover:underline">Apply</button>
          </div>
        </div>
      </div>

      {/* Sanctuary Promise */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h4 className="text-sm font-black text-slate-800 tracking-tight">Sanctuary Promise</h4>
        </div>
        
        <div className="space-y-5">
          <div className="flex gap-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-black text-slate-700">Verified Professionals</p>
              <p className="text-[10px] font-bold text-slate-400">Background checked and highly trained experts only.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
            <div>
              <p className="text-xs font-black text-slate-700">Hassle Free Booking</p>
              <p className="text-[10px] font-bold text-slate-400">Scheduled at your convenience with instant confirmation.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Cart Section */}
      {cartItems.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 space-y-6">
            <h4 className="text-sm font-black text-slate-800 tracking-tight">Your Cart</h4>
            
            <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-700 max-w-[140px] leading-tight">{item.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 font-mono tracking-tight">₹{item.price * item.quantity}.00</p>
                  </div>
                  <div className="flex items-center gap-3 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <button onClick={() => onUpdateQuantity(item.id, -1)} className="p-0.5 hover:text-[#1D2B83] text-slate-400">
                      <Minus className="w-3 h-3 stroke-[3]" />
                    </button>
                    <span className="text-[10px] font-black text-slate-700 w-2 text-center">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(item.id, 1)} className="p-0.5 hover:text-[#1D2B83] text-slate-400">
                      <Plus className="w-3 h-3 stroke-[3]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-dashed border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 tracking-widest">Total amount</p>
              <p className="text-lg font-black text-[#1D2B83] tracking-tighter">₹{totalAmount.toFixed(2)}</p>
            </div>

            <button className="w-full bg-[#1D2B83] hover:bg-[#151f63] text-white py-4 rounded-xl font-black text-[13px] tracking-tight transition-all shadow-lg shadow-[#1D2B83]/20 flex items-center justify-center gap-2 group">
              View Cart & Checkout
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-[9px] font-bold text-slate-400 text-center tracking-widest">Free cancellation until 2hrs before</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingSidebar;
