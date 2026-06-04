"use client";

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { createPortal } from 'react-dom';
import Badge from '../common/Badge';
import Button from '../common/Button';
import { User } from '../types';
import { Mail, Phone, Calendar, Shield, History, MessageSquare, AlertCircle, ExternalLink, User as UserIcon, X, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface UserDetailsModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = React.useState<'profile' | 'bookings' | 'complaints'>('profile');
  const [mounted, setMounted] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && user?.id) {
      fetchUserHistory();
    }
  }, [isOpen, user?.id]);

  const fetchUserHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };

      // Sequentially fetch for better stability and debugging
      const bRes = await axios.get(`${API_URL}/bookings/user/${user.id}`, config);
      setBookings(bRes.data);

      const cRes = await axios.get(`${API_URL}/complaints/user/${user.id}`, config);
      setComplaints(cRes.data);
    } catch (error: any) {
      console.error('BUREAU ERROR:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !user) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto"
        >
          {/* Header */}
          <div className="px-8 pt-4 pb-1 flex justify-between items-center">
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">User Portfolio Bureau</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="px-8 pb-6 space-y-5">
            {/* Essential Profile Card */}
            <div className="bg-[#F8FAFC] border border-gray-100 p-5 rounded-[2rem] flex items-center gap-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4">
                <span className={`px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.status}</span>
              </div>

              <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-blue-200 uppercase overflow-hidden">
                {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.split(' ').map((n: string) => n[0]).join('')}
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter">{user.name}</h3>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-3">Registry ID: {user.id.toString().slice(-6).toUpperCase()}</p>

                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <Mail size={12} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                      <Phone size={12} />
                    </div>
                    <span className="text-[11px] font-bold text-gray-500">{user.phone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Bureau */}
            <div className="flex gap-2 p-1.5 bg-[#F1F5F9] rounded-2xl">
              {[
                { id: 'profile', label: 'Identity Bureau', icon: UserIcon },
                { id: 'bookings', label: 'History Warehouse', icon: History },
                { id: 'complaints', label: 'Issue Tracker', icon: AlertCircle },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm border border-white'
                    : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Viewport */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="min-h-[300px]"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RefreshCcw size={40} className="text-blue-500 animate-spin opacity-50" />
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] animate-pulse">Accessing Encrypted Records...</p>
                </div>
              ) : (
                <>
                  {activeTab === 'profile' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-100 p-5 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Identity Bureau</span>
                          <Shield size={14} className="text-blue-500" />
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-relaxed uppercase tracking-wide">Standard inspection required for this high-volume account tier.</p>
                        <button className="flex items-center gap-2 text-[10px] font-black text-blue-600">
                          VIEW COMPLIANCE <ExternalLink size={10} />
                        </button>
                      </div>
                      <div className="bg-white border border-gray-100 p-5 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Credential Hub</span>
                          <Calendar size={14} className="text-green-500" />
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-relaxed uppercase tracking-wide">Account active since {user.joinedDate || 'March 2026'}.</p>
                        <button className="flex items-center gap-2 text-[10px] font-black text-green-600">
                          VIEW LOGS <ExternalLink size={10} />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'bookings' && (
                    <div className="bg-[#0F172A] rounded-[2rem] p-6 text-white overflow-hidden relative min-h-[300px]">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <History size={150} />
                      </div>
                      <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-6">Historical Data Repository</h4>

                      {bookings.length > 0 ? (
                        <div className="space-y-3 relative z-10 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {bookings.map(bk => (
                            <div key={bk._id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                                  <Calendar size={18} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-white">{bk.service_id?.service_name || 'Service'}</p>
                                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">ID: {bk._id.slice(-6).toUpperCase()} • {new Date(bk.booking_date).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-white">₹{bk.total_amount}</p>
                                <p className={`text-[8px] font-black uppercase tracking-tighter ${bk.status === 'completed' ? 'text-green-400' : bk.status === 'cancelled' ? 'text-red-400' : 'text-blue-400'}`}>
                                  {bk.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-20 text-center space-y-3 opacity-30">
                          <History size={48} className="mx-auto" />
                          <p className="text-xs font-bold uppercase tracking-widest">Zero transactions detected.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'complaints' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">User Issue Tracker</h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${complaints.length > 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                          {complaints.length} Reported Incidents
                        </span>
                      </div>

                      {complaints.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {complaints.map(cp => (
                            <div key={cp._id} className="p-5 border border-gray-100 rounded-[1.5rem] bg-white hover:border-red-200 transition-all group">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${cp.status === 'pending' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                    <MessageSquare size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-gray-800 tracking-tight">{cp.complaint.substring(0, 40)}{cp.complaint.length > 40 ? '...' : ''}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Case ID: {cp._id.slice(-6).toUpperCase()} • {new Date(cp.createdAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${cp.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {cp.status}
                                </span>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Analyze Case</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-20 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                          <Shield size={32} className="mx-auto text-gray-300 mb-3" />
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Clean Compliance Record</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Operational Controls */}
            <div className="flex gap-3 pt-4 border-t border-gray-100">
              {/* <button onClick={onClose} className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Close Pipeline</button>
              <button className="px-8 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 hover:scale-105 transition-all">Terminate Account</button> */}
              <button className="px-8 py-4 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-200 hover:scale-105 transition-all">Elevate Access</button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default UserDetailsModal;
