"use client";

import React from "react";
import { Info } from "lucide-react";

const TIME_SLOTS = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM"
];

interface TimeSlotSelectionProps {
  selectedDate: "today" | "tomorrow";
  setSelectedDate: (date: "today" | "tomorrow") => void;
  selectedSlot: string | null;
  setSelectedSlot: (slot: string) => void;
}

export default function TimeSlotSelection({
  selectedDate,
  setSelectedDate,
  selectedSlot,
  setSelectedSlot
}: TimeSlotSelectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-end px-1">

        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button 
            onClick={() => setSelectedDate("today")}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedDate === "today" ? "bg-white text-[#1D2B83] shadow-sm" : "text-slate-400"}`}
          >
            Today
          </button>
          <button 
            onClick={() => setSelectedDate("tomorrow")}
            className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedDate === "tomorrow" ? "bg-white text-[#1D2B83] shadow-sm" : "text-slate-400"}`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => setSelectedSlot(slot)}
              className={`py-4 rounded-2xl text-xs font-black transition-all border-2 ${
                selectedSlot === slot 
                  ? "bg-[#1D2B83] border-[#1D2B83] text-white shadow-lg shadow-blue-900/20" 
                  : "bg-slate-50 border-transparent text-slate-400 hover:border-slate-200 hover:text-slate-600"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>
        <div className="mt-8 flex items-center gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
          <Info className="w-5 h-5 text-blue-600" />
          <p className="text-[11px] font-bold text-blue-800 leading-tight">
            Professional will arrive within 30 minutes of the selected time slot.
          </p>
        </div>
      </div>
    </section>
  );
}
