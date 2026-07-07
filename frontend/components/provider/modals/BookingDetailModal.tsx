"use client";

import React, { useState, useEffect } from 'react';
import Modal from '@/components/admin/common/Modal';
import {
  Calendar, Clock, MapPin, Phone, User,
  CheckCircle2, AlertCircle, X, Play, CheckCircle, Camera
} from 'lucide-react';

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any | null;
  onUpdateStatus: (id: string, newStatus: string, isRequest?: boolean) => Promise<void>;
  onStartService?: (booking: any, beforePhotos: string[]) => Promise<void>;
  onFinishService?: (booking: any, afterPhotos: string[]) => Promise<void>;
  onOpenOtpModal?: (booking: any, type: 'start' | 'end') => void;
  actionLoading?: string | null;
}

export default function BookingDetailModal({
  isOpen,
  onClose,
  booking,
  onUpdateStatus,
  onStartService,
  onFinishService,
  onOpenOtpModal,
  actionLoading
}: BookingDetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (booking) {
      setBeforePhotos(booking.beforePhotos || []);
      setAfterPhotos(booking.afterPhotos || []);
    }
  }, [booking]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'before') {
          setBeforePhotos(prev => [...prev, base64String]);
        } else {
          setAfterPhotos(prev => [...prev, base64String]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

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
            booking.rawStatus === "waiting_start_otp" ? (
              <button
                onClick={() => {
                  onOpenOtpModal?.(booking, 'start');
                  onClose();
                }}
                disabled={actionLoading === booking._id || beforePhotos.length === 0}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Verify Start OTP
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (onStartService) {
                    await onStartService(booking, beforePhotos);
                    onClose();
                  }
                }}
                disabled={actionLoading === booking._id || beforePhotos.length === 0}
                className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {actionLoading === booking._id ? "Starting..." : "Start Service"}
              </button>
            )
          )}

          {(booking.status === "In Progress" || booking.status === "In progress") && (
            booking.rawStatus === "waiting_end_otp" ? (
              <button
                onClick={() => {
                  onOpenOtpModal?.(booking, 'end');
                  onClose();
                }}
                disabled={actionLoading === booking._id || afterPhotos.length === 0}
                className="px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Verify End OTP
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (onFinishService) {
                    await onFinishService(booking, afterPhotos);
                    onClose();
                  }
                }}
                disabled={actionLoading === booking._id || afterPhotos.length === 0}
                className="px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {actionLoading === booking._id ? "Finishing..." : "Finish Service"}
              </button>
            )
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

        {/* Service Photos Section */}
        {booking.status !== "Pending" && booking.status !== "Rejected" && booking.status !== "Cancelled" && (
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">Service Photos</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Before Photos Card */}
              <div className="flex flex-col items-center">
                <label className={`relative flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  booking.status === 'Accepted' || booking.status === 'Confirmed'
                    ? 'border-primary/40 hover:border-primary bg-primary/5'
                    : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                }`}>
                  {(booking.status === 'Accepted' || booking.status === 'Confirmed') && (
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'before')}
                    />
                  )}
                  {beforePhotos.length > 0 ? (
                    <div className="absolute inset-0 p-1.5 flex gap-1.5 overflow-x-auto bg-slate-900/10 rounded-2xl">
                      {beforePhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square h-full rounded-lg overflow-hidden shrink-0 border border-white">
                          <img src={photo} className="h-full w-full object-cover" />
                          {(booking.status === 'Accepted' || booking.status === 'Confirmed') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setBeforePhotos(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Camera className="h-8 w-8 text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-500">Before Photos</span>
                    </div>
                  )}
                </label>
                <div className="flex items-center gap-1.5 mt-2">
                  {beforePhotos.length > 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-600">{beforePhotos.length} Uploaded</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-slate-400" />
                      <span className="text-xs font-medium text-slate-400">Required to start</span>
                    </>
                  )}
                </div>
              </div>

              {/* After Photos Card */}
              <div className="flex flex-col items-center">
                <label className={`relative flex flex-col items-center justify-center w-full aspect-video rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  booking.status === 'In Progress' || booking.status === 'In progress'
                    ? 'border-primary/40 hover:border-primary bg-primary/5'
                    : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                }`}>
                  {(booking.status === 'In Progress' || booking.status === 'In progress') && (
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handlePhotoUpload(e, 'after')}
                    />
                  )}
                  {afterPhotos.length > 0 ? (
                    <div className="absolute inset-0 p-1.5 flex gap-1.5 overflow-x-auto bg-slate-900/10 rounded-2xl">
                      {afterPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square h-full rounded-lg overflow-hidden shrink-0 border border-white">
                          <img src={photo} className="h-full w-full object-cover" />
                          {(booking.status === 'In Progress' || booking.status === 'In progress') && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAfterPhotos(prev => prev.filter((_, i) => i !== idx));
                              }}
                              className="absolute top-1 right-1 p-0.5 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Camera className="h-8 w-8 text-slate-400 mb-1" />
                      <span className="text-xs font-bold text-slate-500">After Photos</span>
                    </div>
                  )}
                </label>
                <div className="flex items-center gap-1.5 mt-2">
                  {afterPhotos.length > 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-600">{afterPhotos.length} Uploaded</span>
                    </>
                  ) : (
                    booking.status === 'In Progress' || booking.status === 'In progress' ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-blue-500 animate-pulse" />
                        <span className="text-xs font-bold text-blue-600">Pending completion</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-400">Waiting for start</span>
                      </>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
