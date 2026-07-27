"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, AlertCircle, Clock, ShieldAlert, Edit2, X } from 'lucide-react';
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
      <div className="w-full pb-16 space-y-8 animate-pulse">
        <div className="h-16 bg-slate-200 rounded-2xl w-1/3"></div>
        <div className="h-48 bg-slate-200 rounded-2xl"></div>
        <div className="h-48 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Refund & Cancellation Policy</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Configure global platform rules for customer cancellations and associated penalty fees.</p>
        </div>
        {!isEditing ? (
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            <Edit2 size={16} className="text-slate-500" /> Edit Policy
          </button>
        ) : (
          <button 
            onClick={() => {
              setIsEditing(false);
              fetchPolicy(); // Discard changes
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-700 text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            <X size={16} /> Cancel Editing
          </button>
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Booking Cancellation Rules */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Clock size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Standard Cancellation</h2>
                <p className="text-xs font-medium text-slate-500">Rules after initial booking.</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cancel Within Booking Hours</label>
                {isEditing ? (
                  <div className="relative">
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.cancelWithinBookingHours) ? '' : policy.cancelWithinBookingHours}
                      onChange={(e) => handleChange('cancelWithinBookingHours', parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-12"
                    />
                    <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">hrs</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 border-b border-slate-100 pb-2">
                    <span className="text-2xl font-black text-slate-900">{policy.cancelWithinBookingHours}</span>
                    <span className="text-sm font-bold text-slate-500 mb-1">Hours</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cancellation Fee</label>
                {isEditing ? (
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-sm font-bold text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.bookingCancellationFee) ? '' : policy.bookingCancellationFee}
                      onChange={(e) => handleChange('bookingCancellationFee', parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                ) : (
                  <div className="flex items-end gap-1 border-b border-slate-100 pb-2">
                    <span className="text-lg font-bold text-slate-400 mb-0.5">₹</span>
                    <span className="text-2xl font-black text-slate-900">{policy.bookingCancellationFee}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Last Minute Cancellation Rules */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center gap-4 mb-8 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <AlertCircle size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Last Minute Cancellation</h2>
                <p className="text-xs font-medium text-slate-500">Penalties right before service.</p>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Hours Before Service</label>
                {isEditing ? (
                  <div className="relative">
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.lastMinuteHours) ? '' : policy.lastMinuteHours}
                      onChange={(e) => handleChange('lastMinuteHours', parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all pr-12"
                    />
                    <span className="absolute right-4 top-3 text-sm font-bold text-slate-400">hrs</span>
                  </div>
                ) : (
                  <div className="flex items-end gap-2 border-b border-slate-100 pb-2">
                    <span className="text-2xl font-black text-slate-900">{policy.lastMinuteHours}</span>
                    <span className="text-sm font-bold text-slate-500 mb-1">Hours</span>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cancellation Fee</label>
                {isEditing ? (
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-sm font-bold text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={Number.isNaN(policy.lastMinuteCancellationFee) ? '' : policy.lastMinuteCancellationFee}
                      onChange={(e) => handleChange('lastMinuteCancellationFee', parseInt(e.target.value, 10))}
                      className="w-full px-4 py-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                    />
                  </div>
                ) : (
                  <div className="flex items-end gap-1 border-b border-slate-100 pb-2">
                    <span className="text-lg font-bold text-slate-400 mb-0.5">₹</span>
                    <span className="text-2xl font-black text-slate-900">{policy.lastMinuteCancellationFee}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Rules */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Additional Constraints</h2>
              <p className="text-xs font-medium text-slate-500">Service state constraints for allowed cancellations.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            <div className={`flex items-start gap-4 p-5 rounded-2xl transition-all ${isEditing && policy.allowCancellationAfterProviderAssigned ? 'border-purple-200 bg-purple-50/50 border' : isEditing ? 'border-slate-200 hover:bg-slate-50 border' : 'bg-slate-50/50 border border-slate-100'}`}>
              <div className="flex-1">
                <span className="text-sm font-bold text-slate-900 block mb-1">Allow Cancellation After Provider Assigned</span>
                <span className="text-xs font-medium text-slate-500 leading-relaxed block">Customer can still cancel even if a provider has been dispatched to their location.</span>
              </div>
              {isEditing ? (
                <input 
                  type="checkbox" 
                  checked={policy.allowCancellationAfterProviderAssigned}
                  onChange={(e) => handleChange('allowCancellationAfterProviderAssigned', e.target.checked)}
                  className="w-5 h-5 mt-1 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" 
                />
              ) : (
                <span className={`px-4 py-1.5 text-xs font-bold rounded-lg mt-1 ${policy.allowCancellationAfterProviderAssigned ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                  {policy.allowCancellationAfterProviderAssigned ? 'Yes' : 'No'}
                </span>
              )}
            </div>

            <div className={`flex items-start gap-4 p-5 rounded-2xl transition-all ${isEditing && policy.allowCancellationAfterServiceStarted ? 'border-purple-200 bg-purple-50/50 border' : isEditing ? 'border-slate-200 hover:bg-slate-50 border' : 'bg-slate-50/50 border border-slate-100'}`}>
              <div className="flex-1">
                <span className="text-sm font-bold text-slate-900 block mb-1">Allow Cancellation After Service Started</span>
                <span className="text-xs font-medium text-slate-500 leading-relaxed block">Customer can cancel after the provider marks the job as successfully started.</span>
              </div>
              {isEditing ? (
                <input 
                  type="checkbox" 
                  checked={policy.allowCancellationAfterServiceStarted}
                  onChange={(e) => handleChange('allowCancellationAfterServiceStarted', e.target.checked)}
                  className="w-5 h-5 mt-1 rounded text-purple-600 focus:ring-purple-500 cursor-pointer" 
                />
              ) : (
                <span className={`px-4 py-1.5 text-xs font-bold rounded-lg mt-1 ${policy.allowCancellationAfterServiceStarted ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                  {policy.allowCancellationAfterServiceStarted ? 'Yes' : 'No'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {isEditing && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end pt-4"
          >
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
            >
              <Save size={18} /> Save Policy
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
