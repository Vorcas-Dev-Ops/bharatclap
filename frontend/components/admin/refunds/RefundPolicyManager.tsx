"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Clock, Edit3, X, CheckCircle2, XCircle, ShieldAlert, FileText, Users, Calendar, Shield, Info } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function RefundPolicyManager() {
  const [policy, setPolicy] = useState({
    cancelWithinBookingHours: 12,
    bookingCancellationFee: 150,
    lastMinuteHours: 3,
    lastMinuteCancellationFee: 300,
    allowCancellationAfterProviderAssigned: true,
    allowCancellationAfterServiceStarted: false,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPolicy = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const response = await axios.get(`${API_URL}/admin/refund-policy`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setPolicy(response.data);
      }
    } catch (error: any) {
      console.warn('[RefundPolicyManager] Using default refund policy state (fetch notice):', error?.message || error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy();
  }, []);

  const handleChange = (field: string, value: any) => {
    setPolicy(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const response = await axios.put(`${API_URL}/admin/refund-policy`, policy, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data) {
        setPolicy(response.data);
        setIsEditing(false);
        alert('Refund Policy successfully updated!');
      }
    } catch (error) {
      console.error('Error updating refund policy:', error);
      alert('Failed to update refund policy. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-4 animate-pulse p-4">
        <div className="h-10 bg-slate-200 rounded-xl w-1/3"></div>
        <div className="grid grid-cols-2 gap-4 h-48 bg-slate-200 rounded-2xl"></div>
        <div className="h-32 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  const avgFee = Math.round(((policy.bookingCancellationFee || 0) + (policy.lastMinuteCancellationFee || 0)) / 2);

  return (
    <div className="w-full max-w-[1500px] mx-auto space-y-3 p-0">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 py-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Refund & Cancellation Policy</h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">Configure global platform rules for customer cancellations and associated penalty fees.</p>
        </div>
        <div>
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 text-blue-600 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <Edit3 size={14} /> Edit Policy
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsEditing(false);
                  fetchPolicy();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                <X size={14} /> Cancel
              </button>
              <button 
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
              >
                <Save size={14} /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* ── TOP ROW: TWO CANCELLATION CARDS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* Card 1: Standard Cancellation */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Standard Cancellation</h2>
                  <p className="text-xs font-medium text-slate-400">Rules after initial booking.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold rounded-lg shrink-0">
                Default
              </span>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-3 my-2">
              {/* Row 1: Cancel Within Booking Hours */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Cancel Within Booking Hours</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.cancelWithinBookingHours) ? '' : policy.cancelWithinBookingHours}
                      onChange={(e) => handleChange('cancelWithinBookingHours', parseInt(e.target.value, 10))}
                      className="w-20 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    />
                    <span className="text-xs font-bold text-slate-500">Hours</span>
                  </div>
                ) : (
                  <span className="text-lg font-black text-blue-700">{policy.cancelWithinBookingHours} <span className="text-xs font-semibold text-slate-500">Hours</span></span>
                )}
              </div>

              <div className="border-b border-slate-200/60" />

              {/* Row 2: Cancellation Fee */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-sm leading-none">₹</span>
                  <span className="text-xs font-bold text-slate-600">Cancellation Fee</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.bookingCancellationFee) ? '' : policy.bookingCancellationFee}
                      onChange={(e) => handleChange('bookingCancellationFee', parseInt(e.target.value, 10))}
                      className="w-24 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-black text-blue-600">₹{policy.bookingCancellationFee}</span>
                )}
              </div>
            </div>

            <div className="bg-blue-50/80 border border-blue-100 text-blue-700 rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-2">
              <Info size={14} className="shrink-0 text-blue-600" />
              <span>Applies to all cancellations made within {policy.cancelWithinBookingHours} hours of booking.</span>
            </div>
          </div>

          {/* Card 2: Last Minute Cancellation */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Last Minute Cancellation</h2>
                  <p className="text-xs font-medium text-slate-400">Penalties right before service.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-orange-50 text-orange-600 border border-orange-100 text-xs font-bold rounded-lg shrink-0">
                Last Minute
              </span>
            </div>

            <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-3.5 space-y-3 my-2">
              {/* Row 1: Hours Before Service */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">Hours Before Service</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.lastMinuteHours) ? '' : policy.lastMinuteHours}
                      onChange={(e) => handleChange('lastMinuteHours', parseInt(e.target.value, 10))}
                      className="w-20 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                    />
                    <span className="text-xs font-bold text-slate-500">Hours</span>
                  </div>
                ) : (
                  <span className="text-lg font-black text-amber-700">{policy.lastMinuteHours} <span className="text-xs font-semibold text-slate-500">Hours</span></span>
                )}
              </div>

              <div className="border-b border-slate-200/60" />

              {/* Row 2: Cancellation Fee */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-sm leading-none">₹</span>
                  <span className="text-xs font-bold text-slate-600">Cancellation Fee</span>
                </div>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.lastMinuteCancellationFee) ? '' : policy.lastMinuteCancellationFee}
                      onChange={(e) => handleChange('lastMinuteCancellationFee', parseInt(e.target.value, 10))}
                      className="w-24 px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-amber-500"
                    />
                  </div>
                ) : (
                  <span className="text-lg font-black text-orange-600">₹{policy.lastMinuteCancellationFee}</span>
                )}
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-100 text-amber-800 rounded-xl px-3.5 py-2 text-xs font-medium flex items-center gap-2">
              <Info size={14} className="shrink-0 text-amber-600" />
              <span>Applies to cancellations made within {policy.lastMinuteHours} hours of service.</span>
            </div>
          </div>

        </div>

        {/* ── MIDDLE ROW: ADDITIONAL CONSTRAINTS ── */}
        <div className="bg-white rounded-2xl p-4 lg:p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Additional Constraints</h2>
              <p className="text-xs font-medium text-slate-400">Service state constraints for allowed cancellations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Constraint 1: Provider Assigned */}
            <div className="bg-emerald-50/40 border border-emerald-100/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Allow Cancellation After Provider Assigned</h3>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Customer can still cancel even if a provider has been dispatched to their location.</p>
                </div>
              </div>
              {isEditing ? (
                <input 
                  type="checkbox" 
                  checked={policy.allowCancellationAfterProviderAssigned}
                  onChange={(e) => handleChange('allowCancellationAfterProviderAssigned', e.target.checked)}
                  className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer shrink-0" 
                />
              ) : (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200/70 flex items-center gap-1 shrink-0">
                  {policy.allowCancellationAfterProviderAssigned ? 'Yes ✓' : 'No ✕'}
                </span>
              )}
            </div>

            {/* Constraint 2: Service Started */}
            <div className="bg-rose-50/40 border border-rose-100/80 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <XCircle size={24} className="text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">Allow Cancellation After Service Started</h3>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Customer can cancel after the provider marks the job as successfully started.</p>
                </div>
              </div>
              {isEditing ? (
                <input 
                  type="checkbox" 
                  checked={policy.allowCancellationAfterServiceStarted}
                  onChange={(e) => handleChange('allowCancellationAfterServiceStarted', e.target.checked)}
                  className="w-5 h-5 text-rose-600 rounded focus:ring-rose-500 cursor-pointer shrink-0" 
                />
              ) : (
                <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200/70 flex items-center gap-1 shrink-0">
                  {policy.allowCancellationAfterServiceStarted ? 'Yes ✓' : 'No ✕'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: 4 METRIC CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1 */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">Total Policies</p>
              <h3 className="text-xl font-black text-slate-900 leading-tight">2</h3>
              <p className="text-[11px] text-slate-400">Active cancellation rules</p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-800/80">Impacted Services</p>
              <h3 className="text-xl font-black text-slate-900 leading-tight">48</h3>
              <p className="text-[11px] text-slate-400">Services under this policy</p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-lg">
              ₹
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-800/80">Avg. Cancellation Fee</p>
              <h3 className="text-xl font-black text-emerald-600 leading-tight">₹{avgFee}</h3>
              <p className="text-[11px] text-slate-400">Average platform fee</p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-800/80">Last Updated</p>
              <h3 className="text-base sm:text-lg font-black text-indigo-900 leading-tight">27 Jul 2026</h3>
              <p className="text-[11px] text-slate-400">by Super Admin</p>
            </div>
          </div>
        </div>

        {/* ── FOOTER NOTE ── */}
        <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-1">
          <Shield size={14} className="text-slate-400" />
          <span>Policy ensures fair treatment for customers and service partners.</span>
        </div>
      </motion.div>
    </div>
  );
}
