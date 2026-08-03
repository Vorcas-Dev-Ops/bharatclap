"use client";

import React from 'react';
import { Modal } from 'antd';
import { Navigation, MapPin, Clock, Calendar, CheckCircle2, ShieldAlert, X } from 'lucide-react';

interface JourneyConfirmationModalProps {
  isOpen: boolean;
  booking: any;
  onClose: () => void;
  onConfirmStart: () => void;
}

export const JourneyConfirmationModal: React.FC<JourneyConfirmationModalProps> = ({
  isOpen,
  booking,
  onClose,
  onConfirmStart
}) => {
  if (!booking) return null;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      closeIcon={null}
      width={520}
      className="journey-confirmation-modal"
    >
      <div className="bg-white rounded-[32px] p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Navigation className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Start Journey</h2>
              <p className="text-xs text-slate-500 font-medium">Confirm details before departing</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Booking Details Card */}
        <div className="bg-slate-50 rounded-2xl p-5 space-y-3.5 border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</span>
            <span className="text-sm font-black text-slate-900">{booking.customer}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Service</span>
            <span className="text-sm font-bold text-indigo-600">{booking.service}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Distance</span>
            <span className="text-sm font-bold text-slate-800">{booking.estimatedDistance || 4.2} km</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estimated Travel Time</span>
            <span className="text-sm font-bold text-emerald-600">{booking.estimatedTravelMinutes || 14} mins</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Time</span>
            <span className="text-sm font-bold text-slate-800">{booking.dateTime}</span>
          </div>
        </div>

        {/* Before You Start Guidelines */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Before you start</h3>
          
          <div className="flex items-start gap-3 text-xs font-medium text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>Ensure you have all required tools & materials.</span>
          </div>
          <div className="flex items-start gap-3 text-xs font-medium text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>Drive safely and follow traffic regulations.</span>
          </div>
          <div className="flex items-start gap-3 text-xs font-medium text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>Navigation will automatically open in Google Maps.</span>
          </div>
          <div className="flex items-start gap-3 text-xs font-medium text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>Once within 100m radius of customer, mark yourself as <strong>"I've Arrived"</strong>.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmStart}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            <Navigation className="h-4 w-4" />
            Start Navigation
          </button>
        </div>
      </div>
    </Modal>
  );
};
