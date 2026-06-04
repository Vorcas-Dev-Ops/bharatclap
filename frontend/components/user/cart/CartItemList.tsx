"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Minus, Trash2, Clock, Calendar, Pencil, AlertCircle } from "lucide-react";
import { BACKEND_URL } from "@/config/api";
import { useCart } from "@/context/CartContext";
import TimeSlotModal from "@/components/services/booking/TimeSlotModal";

interface CartItemListProps {
  items: any[];
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
}

export default function CartItemList({ items, removeFromCart, updateQuantity }: CartItemListProps) {
  const { updateSlot } = useCart();

  // Track which item's "Update Slot" modal is open
  const [editSlot, setEditSlot] = useState<{
    open: boolean;
    subserviceId: string;
    serviceName: string;
    currentDate?: string;
    currentSlot?: string;
  } | null>(null);

  const handleSlotUpdate = async (date: string, slot: string) => {
    if (!editSlot) return;
    setEditSlot(null);
    await updateSlot(editSlot.subserviceId, date, slot);
  };

  /** Format "2026-05-28" → "28 May 2026 (Wed)" */
  const formatDate = (iso: string) => {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", weekday: "short",
      });
    } catch { return iso; }
  };

  return (
    <section className="space-y-4">
      <AnimatePresence mode="popLayout">
        {items?.map((item: any) => {
          const subservice = item.subservice_id;
          if (!subservice) return null;

          const itemId         = subservice._id || subservice;
          const subserviceName = subservice.subservice_name || "Service";
          const categoryName   = subservice.category_id?.category_name || "Home Service";
          const duration       = subservice.duration || "45 mins";
          const price          = item.price_snapshot || 0;
          const quantity       = item.quantity || 1;
          const image          = subservice.image;
          const selectedDate   = item.selected_date;
          const selectedSlot   = item.selected_time_slot;
          const hasSchedule    = !!(selectedDate && selectedSlot);

          return (
            <motion.div
              key={itemId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group relative bg-white rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 overflow-hidden"
            >
              {/* Schedule indicator bar */}
              <div className={`h-1 w-full ${hasSchedule ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-amber-300 to-orange-400"}`} />

              <div className="p-6">
                <div className="flex gap-6">
                  {/* Image */}
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl bg-slate-50 overflow-hidden flex-shrink-0 border border-slate-100">
                    {image ? (
                      <img
                        src={image.startsWith("http") ? image : `${BACKEND_URL}${image}`}
                        alt={subserviceName}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Plus className="w-6 h-6 text-slate-200" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{categoryName}</span>
                      <button
                        onClick={() => removeFromCart(itemId)}
                        className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <h4 className="text-lg font-black text-slate-800 leading-tight mb-2 truncate">{subserviceName}</h4>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        <Clock className="w-3 h-3" />
                        {duration}
                      </div>
                    </div>

                    {/* Controls & Price */}
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => updateQuantity(itemId, Math.max(1, quantity - 1))}
                          className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-slate-600 disabled:opacity-30"
                          disabled={quantity <= 1}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-black text-slate-800 text-sm">{quantity}</span>
                        <button
                          onClick={() => updateQuantity(itemId, quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-all text-slate-600"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Subtotal</p>
                        <p className="text-xl font-black text-[#1D2B83]">₹{price * quantity}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Schedule section ─────────────────────────────────────── */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {hasSchedule ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 leading-none mb-0.5">
                            Scheduled
                          </p>
                          <p className="text-sm font-bold text-slate-700">{formatDate(selectedDate!)}</p>
                          <p className="text-xs font-bold text-slate-500">{selectedSlot}</p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          setEditSlot({
                            open: true,
                            subserviceId: itemId,
                            serviceName: subserviceName,
                            currentDate: selectedDate,
                            currentSlot: selectedSlot,
                          })
                        }
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-[#1D2B83]/30 hover:bg-blue-50 text-slate-500 hover:text-[#1D2B83] transition-all text-xs font-bold"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Update Slot
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-xs font-bold">No schedule set — please pick a time slot before checkout.</p>
                      </div>
                      <button
                        onClick={() =>
                          setEditSlot({
                            open: true,
                            subserviceId: itemId,
                            serviceName: subserviceName,
                          })
                        }
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 transition-all text-xs font-bold"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        Pick Slot
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Update / Pick Slot Modal */}
      {editSlot && (
        <TimeSlotModal
          isOpen={editSlot.open}
          serviceName={editSlot.serviceName}
          mode="update"
          initialDate={editSlot.currentDate}
          initialSlot={editSlot.currentSlot?.split(" - ")[0]} // "10:00 AM - 11:00 AM" → "10:00 AM"
          onClose={() => setEditSlot(null)}
          onConfirm={handleSlotUpdate}
        />
      )}
    </section>
  );
}
