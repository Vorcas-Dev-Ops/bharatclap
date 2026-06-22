"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, AlertCircle } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const TIME_SLOTS = [
  "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM",
  "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM",
];

const SLOT_DURATION_HOURS = 1;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTodayAndTomorrow(): { today: Date; tomorrow: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return { today, tomorrow };
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
}

/** Returns true if a "HH:MM AM/PM" slot is in the past for today */
function isSlotPast(slot: string, date: Date): boolean {
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (!isToday) return false;

  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  // disable the slot if its END time has already passed (+1 hour buffer)
  const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours + SLOT_DURATION_HOURS, minutes);
  return slotEnd <= now;
}

/** Convert "10:00 AM" → "11:00 AM" (end slot label) */
function slotEndLabel(slot: string): string {
  const [time, meridiem] = slot.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  hours += SLOT_DURATION_HOURS;
  const newMeridiem = hours >= 12 ? "PM" : "AM";
  const display = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${String(display).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${newMeridiem}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TimeSlotModalProps {
  isOpen: boolean;
  serviceName: string;
  mode?: "add" | "update";
  initialDate?: string;
  initialSlot?: string;
  onClose: () => void;
  onConfirm: (date: string, slot: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const TimeSlotModal: React.FC<TimeSlotModalProps> = ({
  isOpen,
  serviceName,
  mode = "add",
  initialDate,
  initialSlot,
  onClose,
  onConfirm,
}) => {
  const { today, tomorrow } = getTodayAndTomorrow();

  const [selectedDate, setSelectedDate] = useState<Date>(
    initialDate ? new Date(initialDate + "T00:00:00") : today
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(initialSlot || null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!selectedDate) {
      setValidationError("Please select a date.");
      return;
    }
    if (!selectedSlot) {
      setValidationError("Please select a time slot.");
      return;
    }
    setValidationError(null);
    const slotLabel = `${selectedSlot} - ${slotEndLabel(selectedSlot)}`;
    onConfirm(formatDateISO(selectedDate), slotLabel);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="timeslot-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[400]"
        />
      )}

      {isOpen && (
        <div key="timeslot-modal-container" className="fixed inset-0 flex items-end sm:items-center justify-center z-[401] p-0 sm:p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="bg-white w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[85vh] pointer-events-auto"
          >
            {/* Top accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#1D2B83] via-blue-500 to-indigo-400" />

            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">
                  {mode === "update" ? "Update Schedule" : "Schedule Your Service"}
                </p>
                <h2 className="text-lg font-black text-slate-800 leading-tight">{serviceName}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* ── Date picker ──────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-[#1D2B83]" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">Select Date</p>
                </div>

                {/* Today / Tomorrow toggle */}
                <div className="grid grid-cols-2 gap-3">
                  {[today, tomorrow].map((day, i) => {
                    const isSelected = formatDateISO(day) === formatDateISO(selectedDate);
                    const label = i === 0 ? "Today" : "Tomorrow";
                    return (
                      <button
                        key={label}
                        onClick={() => { setSelectedDate(day); setSelectedSlot(null); setValidationError(null); }}
                        className={`
                          flex flex-col items-center py-4 px-4 rounded-2xl border-2 transition-all duration-200
                          ${
                            isSelected
                              ? "bg-[#1D2B83] border-[#1D2B83] text-white shadow-lg shadow-blue-900/20"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:border-[#1D2B83]/40 hover:bg-blue-50"
                          }
                        `}
                      >
                        <span className={`text-xs font-black uppercase tracking-widest mb-1 ${
                          isSelected ? "text-blue-200" : "text-slate-400"
                        }`}>{label}</span>
                        <span className={`text-2xl font-black ${
                          isSelected ? "text-white" : "text-slate-800"
                        }`}>{day.getDate()}</span>
                        <span className={`text-xs font-bold mt-0.5 ${
                          isSelected ? "text-blue-200" : "text-slate-400"
                        }`}>
                          {day.toLocaleDateString("en-IN", { month: "short", weekday: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Time slots ───────────────────────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-[#1D2B83]" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-600">Available Time Slots</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => {
                    const isPast = selectedDate ? isSlotPast(slot, selectedDate) : false;
                    const isSelected = selectedSlot === slot;

                    return (
                      <button
                        key={slot}
                        disabled={isPast}
                        onClick={() => { setSelectedSlot(slot); setValidationError(null); }}
                        className={`
                          relative py-2.5 px-2 rounded-2xl text-xs font-black transition-all duration-200 border
                          ${isPast
                            ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through"
                            : isSelected
                              ? "bg-[#1D2B83] text-white border-[#1D2B83] shadow-lg shadow-blue-900/20 scale-[1.04]"
                              : "bg-slate-50 text-slate-600 border-slate-100 hover:border-[#1D2B83]/30 hover:bg-blue-50 hover:text-[#1D2B83]"
                          }
                        `}
                      >
                        {slot}
                        {isPast && (
                          <span className="block text-[8px] font-bold text-slate-300 mt-0.5 normal-case no-underline" style={{ textDecoration: 'none' }}>
                            Unavailable
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Selected summary ─────────────────────────────────────────── */}
              {selectedDate && selectedSlot && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1D2B83] flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-[#1D2B83]">
                      {formatDateDisplay(selectedDate)}
                    </p>
                    <p className="text-sm font-black text-slate-700">
                      {selectedSlot} — {slotEndLabel(selectedSlot)}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Validation error ─────────────────────────────────────────── */}
              <AnimatePresence>
                {validationError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs font-bold text-red-600">{validationError}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 h-12 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-12 rounded-2xl bg-[#1D2B83] hover:bg-[#162268] text-white font-black text-sm transition-colors shadow-lg shadow-blue-900/20"
              >
                {mode === "update" ? "Update Schedule" : "Add to Cart"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TimeSlotModal;
