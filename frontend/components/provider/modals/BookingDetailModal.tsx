"use client";

import React, { useState } from 'react';
import Modal from '@/components/admin/common/Modal';
import { 
  Calendar, Clock, MapPin, Phone, User, 
  CheckCircle2, AlertCircle, X, Play, CheckCircle
} from 'lucide-react';

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any | null;
  onUpdateStatus: (id: string, newStatus: string, isRequest?: boolean) => Promise<void>;
}

export default function BookingDetailModal({ isOpen, onClose, booking, onUpdateStatus }: BookingDetailModalProps) {
  const [updating, setUpdating] = useState(false);

  if (!booking) return null;

  const statusColors: Record<string, string> = {
    Pending: "bg-amber-50 text-amber-600 border-amber-100",
    Accepted: "bg-blue-50 text-blue-600 border-blue-100",
    "In Progress": "bg-purple-50 text-purple-600 border-purple-100",
    Completed: "bg-emerald-50 text-emerald-600 border-emerald-100",
    "In progress": "bg-purple-50 text-purple-600 border-purple-100",
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdating(true);
      await onUpdateStatus(booking._id, newStatus, booking.isRequest);
      onClose();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Booking Details"
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            Close
          </button>
          
          {booking.status === "Pending" && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleStatusChange("Accepted")}
                disabled={updating}
                className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {updating ? "Processing..." : "Accept Booking"}
              </button>
              <button 
                onClick={() => handleStatusChange("Rejected")}
                disabled={updating}
                className="px-6 py-2.5 bg-rose-50 text-rose-600 text-sm font-bold rounded-xl hover:bg-rose-100 transition-all border border-rose-100 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}

          {(booking.status === "Accepted" || booking.status === "Confirmed") && (
            <button 
              onClick={() => handleStatusChange("In Progress")}
              disabled={updating}
              className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {updating ? "Starting..." : "Start Job"}
            </button>
          )}

          {(booking.status === "In Progress" || booking.status === "In progress") && (
            <button 
              onClick={() => handleStatusChange("Completed")}
              disabled={updating}
              className="px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {updating ? "Completing..." : "Mark as Completed"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="flex items-center gap-5 p-5 bg-slate-50 rounded-2xl border border-slate-100">
          <img src={booking.avatar} alt="" className="h-16 w-16 rounded-2xl border-2 border-white shadow-sm" />
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900">{booking.customer}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase">{booking.id}</span>
              <span className={`text-xs font-bold px-3 py-0.5 rounded-lg border ${statusColors[booking.status] || "bg-slate-50 text-slate-600 border-slate-100"}`}>
                {booking.status}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Amount</span>
            <span className="text-2xl font-black text-slate-900">{booking.amount}</span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
            <div className="p-2 bg-primary/10 text-primary rounded-xl mt-0.5">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Date & Time</span>
              <span className="text-sm font-bold text-slate-900">{booking.dateTime}</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
            <div className="p-2 bg-primary/10 text-primary rounded-xl mt-0.5">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Service</span>
              <span className="text-sm font-bold text-slate-900">{booking.service}</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
            <div className="p-2 bg-primary/10 text-primary rounded-xl mt-0.5">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Contact</span>
              <span className="text-sm font-bold text-slate-900">{booking.phone}</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100">
            <div className="p-2 bg-primary/10 text-primary rounded-xl mt-0.5">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider block mb-1">Address</span>
              <span className="text-sm font-bold text-slate-900 leading-relaxed">{booking.address}</span>
            </div>
          </div>
        </div>

        {/* Alert for pending */}
        {booking.status === "Pending" && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              This booking is pending your acceptance. Please accept or decline within 30 minutes to maintain your response rate.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
