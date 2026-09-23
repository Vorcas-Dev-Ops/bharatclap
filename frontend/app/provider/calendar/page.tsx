"use client";

import React, { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/config/api";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Loader2,
  CircleDot,
} from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const totalDays = last.getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface Booking {
  _id: string;
  booking_id?: string;
  customer?: { name?: string; phone?: string };
  services?: { service_name?: string; subservice_name?: string }[];
  scheduled_date?: string;
  scheduled_time?: string;
  status?: string;
  address?: { full_address?: string; area?: string; city?: string };
  total_amount?: number;
}

export default function ProviderCalendarPage() {
  const today = new Date();
  const [focusedMonth, setFocusedMonth] = useState(today.getMonth());
  const [focusedYear, setFocusedYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/bookings/my?limit=500");
        const data = Array.isArray(res.data) ? res.data : res.data?.bookings || [];
        setBookings(data);
      } catch (e) {
        console.error("[Calendar] Failed to load bookings", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Map: "YYYY-MM-DD" → count
  const dateCountMap = useMemo(() => {
    const map = new Map<string, number>();
    bookings.forEach((b) => {
      if (!b.scheduled_date) return;
      const d = new Date(b.scheduled_date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [bookings]);

  const getCountForDay = (day: number) => {
    const key = `${focusedYear}-${focusedMonth}-${day}`;
    return dateCountMap.get(key) || 0;
  };

  const selectedDayBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!b.scheduled_date) return false;
      return isSameDay(new Date(b.scheduled_date), selectedDate);
    });
  }, [bookings, selectedDate]);

  const prevMonth = () => {
    if (focusedMonth === 0) { setFocusedMonth(11); setFocusedYear((y) => y - 1); }
    else setFocusedMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (focusedMonth === 11) { setFocusedMonth(0); setFocusedYear((y) => y + 1); }
    else setFocusedMonth((m) => m + 1);
  };
  const goToday = () => {
    setFocusedMonth(today.getMonth());
    setFocusedYear(today.getFullYear());
    setSelectedDate(today);
  };

  const cells = getMonthGrid(focusedYear, focusedMonth);

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    accepted: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-indigo-100 text-indigo-700 border-indigo-200",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <CalendarIcon size={22} className="text-blue-600" />
            Job Calendar
          </h1>
          <p className="text-xs text-gray-500 font-medium">View your scheduled jobs by date</p>
        </div>
        <button onClick={goToday} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all">
          Today
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm">
            {/* Month Nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-black text-gray-900">
                {MONTHS[focusedMonth]} {focusedYear}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Date Cells */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={i} />;
                const cellDate = new Date(focusedYear, focusedMonth, day);
                const isToday = isSameDay(cellDate, today);
                const isSelected = isSameDay(cellDate, selectedDate);
                const count = getCountForDay(day);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(cellDate)}
                    className={`relative p-2 rounded-xl text-sm font-bold transition-all min-h-[48px] flex flex-col items-center justify-center gap-0.5
                      ${isSelected ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" : isToday ? "bg-blue-50 text-blue-700 ring-2 ring-blue-200" : "hover:bg-gray-50 text-gray-700"}
                    `}
                  >
                    {day}
                    {count > 0 && (
                      <div className={`flex items-center gap-0.5 ${isSelected ? "text-blue-100" : "text-blue-500"}`}>
                        <CircleDot size={8} />
                        <span className="text-[9px] font-black">{count}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Jobs */}
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black text-gray-900 mb-4">
              {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
            </h3>

            {selectedDayBookings.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CalendarIcon size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-bold">No jobs on this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayBookings.map((b) => {
                  const serviceName = b.services?.[0]?.subservice_name || b.services?.[0]?.service_name || "Service";
                  const st = (b.status || "pending").toLowerCase().replace(/ /g, "_");
                  const colorClass = statusColor[st] || "bg-gray-100 text-gray-700 border-gray-200";

                  return (
                    <div key={b._id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-900">{serviceName}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                          {b.status}
                        </span>
                      </div>
                      {b.scheduled_time && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Clock size={12} />
                          <span className="text-[11px] font-medium">{b.scheduled_time}</span>
                        </div>
                      )}
                      {b.customer?.name && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <User size={12} />
                          <span className="text-[11px] font-medium">{b.customer.name}</span>
                        </div>
                      )}
                      {(b.address?.area || b.address?.city) && (
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <MapPin size={12} />
                          <span className="text-[11px] font-medium">{b.address?.area || b.address?.city}</span>
                        </div>
                      )}
                      {b.total_amount != null && (
                        <div className="text-right text-xs font-black text-gray-900">
                          ₹{b.total_amount.toLocaleString("en-IN")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
