"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles
} from "lucide-react";
import { API_URL } from "@/config/api";
import { authFetch } from "@/utils/authFetch";

interface CheckoutSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: any;
  address: any;
  date?: string;
  slot?: string | null;
  paymentMethod: "online" | "cod";
  platformFee: number;
  discount: number;
  totalAmount: number;
  finalTotal: number;
  onConfirm: (scheduleToken?: string, prefDate?: string, prefStart?: string) => void;
  loading?: boolean;
}

const TIME_SLOTS = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"
];

function getTodayISO(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function getTomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

/** Returns true if a "HH:MM AM/PM" slot is in the past for today (slot start time <= now) */
function isSlotPast(slot: string, dateStr: string): boolean {
  const now = new Date();
  const todayISO = getTodayISO();
  if (dateStr !== todayISO) return false;

  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  return slotStart <= now;
}

function getFirstAvailableSlot(dateStr: string): string {
  for (const s of TIME_SLOTS) {
    if (!isSlotPast(s, dateStr)) return s;
  }
  return "09:00 AM";
}

export default function CheckoutSummaryModal({
  isOpen,
  onClose,
  cart,
  address,
  paymentMethod,
  platformFee,
  discount,
  totalAmount,
  finalTotal,
  onConfirm,
  loading = false
}: CheckoutSummaryModalProps) {
  const todayISO = getTodayISO();
  const tomorrowISO = getTomorrowISO();

  const [selectedDate, setSelectedDate] = useState<string>(todayISO);
  const [selectedStartTime, setSelectedStartTime] = useState<string>(() => getFirstAvailableSlot(todayISO));
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [scheduleToken, setScheduleToken] = useState<string | undefined>(undefined);

  // When selectedDate changes, adjust selectedStartTime if current selection is past
  useEffect(() => {
    if (isSlotPast(selectedStartTime, selectedDate)) {
      setSelectedStartTime(getFirstAvailableSlot(selectedDate));
    }
  }, [selectedDate]);

  const validateCurrentSchedule = useCallback(async (dateStr: string, timeStr: string) => {
    if (!cart?.items?.length) return;
    setValidating(true);
    setValidationResult(null);

    try {
      const res = await authFetch(`${API_URL}/bookings/validate-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address_id: address?._id,
          preferred_date: dateStr,
          preferred_start_time: timeStr,
          scheduling_mode: "sequential"
        })
      });

      if (res && res.ok) {
        const data = await res.json();
        setValidationResult(data);
        if (data.available && data.schedule_token) {
          setScheduleToken(data.schedule_token);
        }
      }
    } catch (err) {
      console.warn("Failed to validate schedule", err);
    } finally {
      setValidating(false);
    }
  }, [cart, address]);

  useEffect(() => {
    if (isOpen) {
      validateCurrentSchedule(selectedDate, selectedStartTime);
    }
  }, [isOpen, selectedDate, selectedStartTime, validateCurrentSchedule]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1D2B83] rounded-xl shadow-lg shadow-blue-900/20">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Booking Summary</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Review &amp; Schedule Checkout</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-white rounded-full transition-all shadow-sm">
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
                    {address?.address_type && (
                      <span className="inline-flex items-center text-[#1D2B83] font-black text-[10px] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full mr-2">
                        {address.address_type === "Other" && address.label ? address.label : address.address_type}
                      </span>
                    )}
                    {address?.house_no_building}
                  </p>
                  {(address?.address_line_1 || address?.area_locality) && (
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      {[address.address_line_1, address.address_line_2, address.area_locality].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{address?.city}, {address?.state} - {address?.pincode}</p>
                </div>
              </div>

              {/* Date & Start Time Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <Calendar className="w-3 h-3 text-[#1D2B83]" /> Select Preferred Date &amp; Start Time
                </div>

                {/* Date Pills */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Today", value: todayISO },
                    { label: "Tomorrow", value: tomorrowISO }
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => setSelectedDate(item.value)}
                      className={`py-3 px-4 rounded-2xl text-xs font-black border transition-all ${
                        selectedDate === item.value
                          ? "bg-[#1D2B83] text-white border-[#1D2B83] shadow-md"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50"
                      }`}
                    >
                      {item.label} ({new Date(item.value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                    </button>
                  ))}
                </div>

                {/* Start Time Slot Pills */}
                <div className="grid grid-cols-4 gap-2">
                  {TIME_SLOTS.map((slotStr) => {
                    const isPast = isSlotPast(slotStr, selectedDate);
                    return (
                      <button
                        key={slotStr}
                        disabled={isPast}
                        onClick={() => setSelectedStartTime(slotStr)}
                        className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all ${
                          isPast
                            ? "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed line-through"
                            : selectedStartTime === slotStr
                            ? "bg-[#1D2B83] text-white border-[#1D2B83] scale-[1.03]"
                            : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-blue-50"
                        }`}
                      >
                        {slotStr}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactive Schedule Timeline Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    <Sparkles className="w-3 h-3 text-[#1D2B83]" /> Calculated Schedule Preview
                  </span>
                  {validating && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D2B83]" />}
                </div>

                {validationResult?.available === false ? (
                  /* Unavailable State */
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{validationResult.reason || "This requested start time is unavailable."}</span>
                    </div>
                    {validationResult.suggested_start_times?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-2">Try an available start time:</p>
                        <div className="flex flex-wrap gap-2">
                          {validationResult.suggested_start_times.map((sTime: string) => (
                            <button
                              key={sTime}
                              onClick={() => setSelectedStartTime(sTime)}
                              className="px-3 py-1.5 bg-amber-100 text-amber-900 text-xs font-black rounded-xl hover:bg-amber-200 transition-colors"
                            >
                              {sTime}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Available Schedule Timeline */
                  <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black text-[#1D2B83]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>One provider will handle your services sequentially</span>
                    </div>

                    <div className="space-y-2 pt-1">
                      {validationResult?.timeline?.map((item: any, idx: number) => {
                        if (item.type === "transition") {
                          return (
                            <div key={idx} className="flex items-center gap-3 pl-3 text-[11px] text-slate-400 font-bold italic">
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              <span>{item.label} ({item.travel_buffer_minutes}m)</span>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-blue-100 shadow-sm text-xs">
                            <span className="font-bold text-slate-800">{item.subservice_name} ×{item.quantity}</span>
                            <span className="font-black text-[#1D2B83]">{item.start_time} — {item.end_time}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
            <div className="p-8 bg-slate-50 border-t border-slate-100 space-y-4">
              <button
                onClick={() => onConfirm(scheduleToken, selectedDate, selectedStartTime)}
                disabled={loading || validationResult?.available === false || validating}
                className="w-full h-16 bg-[#1D2B83] text-white font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-blue-800 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Confirm & Book Now"}
                {!loading && <ChevronRight className="w-5 h-5" />}
              </button>
              
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-green-500" />
                Secure Checkout Powered by BharatClap
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
