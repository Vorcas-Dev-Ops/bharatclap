"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  CreditCard
} from "lucide-react";
import { message, Tabs, Button, Tag, Modal } from "antd";
import { API_URL, BACKEND_URL } from "@/config/api";
import { motion, AnimatePresence } from "framer-motion";

interface Booking {
  _id: string;
  booking_id: string;
  subservice_id: any;
  service_id?: any;
  provider_id: any;
  address_id: any;
  scheduled_at: string;
  booking_time: string;
  service_price: number;
  total_amount?: number;
  status: string;
  payment_method: string;
  payment_status: string;
  createdAt: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  refund_status?: string;
  refund_amount?: number;
}

export default function CancelledBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [messageApi, contextHolder] = message.useMessage();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  
  const [detailModal, setDetailModal] = useState<{ open: boolean; item: Booking | null }>({
    open: false, item: null
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      let allBookings: Booking[] = [];
      if (Array.isArray(data)) {
        allBookings = data;
      } else if (data.bookings && Array.isArray(data.bookings)) {
        allBookings = data.bookings;
      }
      
      // Only keep bookings that are cancelled or belong to a group that has at least one cancellation
      const cancelledGroups = new Set(
        allBookings.filter(b => ['cancelled', 'rejected'].includes(b.status)).map(b => b.booking_id)
      );
      
      const filteredBookings = allBookings.filter(b => cancelledGroups.has(b.booking_id));
      setBookings(filteredBookings);
      
      // Auto-expand all by default
      const expansions: Record<string, boolean> = {};
      cancelledGroups.forEach(id => expansions[id] = true);
      setExpandedGroups(expansions);
      
    } catch (err) {
      console.error("Failed to fetch bookings", err);
      messageApi.error("Failed to load your cancelled bookings");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group bookings by booking_id
  const groupedBookings = bookings.reduce((acc, booking) => {
    if (!acc[booking.booking_id]) acc[booking.booking_id] = [];
    acc[booking.booking_id].push(booking);
    return acc;
  }, {} as Record<string, Booking[]>);

  // Filter groups based on active tab
  const getFilteredGroups = () => {
    return Object.entries(groupedBookings).filter(([groupId, items]) => {
      // Find cancelled items in this group
      const cancelledItems = items.filter(i => ['cancelled', 'rejected'].includes(i.status));
      
      if (activeTab === "all") return true;
      
      if (activeTab === "pending") {
        return cancelledItems.some(i => i.refund_status === 'pending' || i.refund_status === 'processing');
      }
      if (activeTab === "refunded") {
        return cancelledItems.some(i => i.refund_status === 'refunded');
      }
      if (activeTab === "no_refund") {
        return cancelledItems.some(i => !i.refund_status || i.refund_status === 'none' || i.refund_status === 'failed');
      }
      return true;
    });
  };

  const filteredGroups = getFilteredGroups();

  const getRefundStatusUI = (status: string | undefined, method: string) => {
    if (method === 'cod') return { color: 'default', text: 'No Refund (COD)', icon: <XCircle size={12} /> };
    
    switch (status) {
      case 'pending': return { color: 'gold', text: 'Refund Pending', icon: <Clock size={12} /> };
      case 'processing': return { color: 'gold', text: 'Processing Refund', icon: <Clock size={12} /> };
      case 'refunded': return { color: 'green', text: 'Refunded', icon: <CheckCircle2 size={12} /> };
      case 'failed': return { color: 'red', text: 'Refund Failed', icon: <AlertCircle size={12} /> };
      default: return { color: 'default', text: 'No Refund Applicable', icon: <XCircle size={12} /> };
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto px-4 py-8">
      {contextHolder}
      
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Cancelled Bookings & Refunds</h1>
        <p className="text-slate-500 font-medium mt-2">Track your cancelled services and refund statuses.</p>
      </div>

      <div className="mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-100 inline-block w-full overflow-x-auto">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="custom-tabs m-0"
          items={[
            { key: 'all', label: 'All Cancelled' },
            { key: 'pending', label: 'Refund Pending' },
            { key: 'refunded', label: 'Refunded' },
            { key: 'no_refund', label: 'No Refund' },
          ]}
        />
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2].map(i => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse h-40" />
          ))}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-16 text-center shadow-sm border border-slate-100 flex flex-col items-center justify-center">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <XCircle className="text-slate-200" size={40} />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">No cancelled bookings</h3>
          <p className="text-slate-400 font-medium mt-2 max-w-sm mx-auto mb-8">
            You haven't cancelled any services yet.
          </p>
          <Button href="/user/bookings" type="primary" className="h-12 px-8 rounded-2xl bg-[#1D2B83] font-black uppercase tracking-widest text-[11px]">
            View My Bookings
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredGroups.map(([groupId, items]) => {
            const isExpanded = expandedGroups[groupId];
            const bookingDate = items[0]?.scheduled_at ? new Date(items[0].scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
            
            // Calculate total refund
            const totalRefund = items.reduce((sum, item) => {
               if (['cancelled', 'rejected'].includes(item.status) && (item.refund_status === 'refunded' || item.refund_status === 'processing' || item.refund_status === 'pending')) {
                 return sum + (item.refund_amount || item.service_price || 0);
               }
               return sum;
            }, 0);

            return (
              <div key={groupId} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                {/* Group Header */}
                <div 
                  className="p-6 border-b border-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleGroup(groupId)}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-black text-slate-800 tracking-tight">{groupId}</h2>
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        {bookingDate}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-400">
                      {items.filter(i => ['cancelled', 'rejected'].includes(i.status)).length} cancelled, {items.filter(i => !['cancelled', 'rejected'].includes(i.status)).length} active/completed
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {totalRefund > 0 && (
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Refund</p>
                        <p className="text-lg font-black text-emerald-600">₹{totalRefund}</p>
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>

                {/* Group Items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 sm:p-6 space-y-4 bg-slate-50/30">
                        {items.map(item => {
                          const subservice = item.subservice_id || item.service_id;
                          const isCancelled = ['cancelled', 'rejected'].includes(item.status);
                          const refUi = getRefundStatusUI(item.refund_status, item.payment_method);
                          const price = item.service_price || item.total_amount || 0;
                          
                          return (
                            <div key={item._id} className={`bg-white p-5 rounded-2xl border ${isCancelled ? 'border-red-100/50' : 'border-emerald-100/50'} shadow-sm flex flex-col sm:flex-row gap-5 items-start sm:items-center`}>
                              
                              <div className="flex-1 w-full">
                                <div className="flex items-center gap-3 mb-2">
                                  {isCancelled ? (
                                    <div className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center flex-shrink-0">
                                      <XCircle size={14} />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center flex-shrink-0">
                                      <CheckCircle2 size={14} />
                                    </div>
                                  )}
                                  <h3 className="font-bold text-slate-800 text-base line-clamp-1">
                                    {subservice?.subservice_name || subservice?.service_name || 'Service Item'}
                                  </h3>
                                </div>
                                
                                {isCancelled ? (
                                  <div className="pl-9 space-y-1">
                                    <p className="text-xs font-medium text-slate-500">
                                      <span className="font-bold text-slate-700">Reason:</span> {item.cancellation_reason || 'No reason provided'}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2">
                                      <Tag color={refUi.color} className="m-0 rounded-lg px-2 py-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider border-none">
                                        {refUi.icon} {refUi.text}
                                      </Tag>
                                      <span className="text-sm font-black text-slate-800">
                                        ₹{item.refund_amount || price}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="pl-9">
                                    <Tag color="green" className="m-0 rounded-lg border-none text-[10px] font-bold uppercase tracking-wider">
                                      {item.status.replace('_', ' ')}
                                    </Tag>
                                  </div>
                                )}
                              </div>
                              
                              {isCancelled && (
                                <div className="w-full sm:w-auto pl-9 sm:pl-0">
                                  <Button 
                                    onClick={() => setDetailModal({ open: true, item })}
                                    className="w-full sm:w-auto rounded-xl font-bold text-xs h-10 text-[#1D2B83] border-slate-200 hover:border-[#1D2B83] hover:text-[#1D2B83]"
                                  >
                                    View Details
                                  </Button>
                                </div>
                              )}
                              
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={detailModal.open}
        onCancel={() => setDetailModal({ open: false, item: null })}
        footer={
          <div className="flex gap-3 pt-4">
            <Button 
              className="flex-1 rounded-xl h-12 font-bold text-[11px] uppercase tracking-widest border-2 border-slate-200"
              onClick={() => window.open('mailto:support@fixvo.com', '_blank')}
            >
              Need Help
            </Button>
            <Button 
              href="/"
              type="primary" 
              className="flex-1 rounded-xl h-12 font-bold text-[11px] uppercase tracking-widest bg-[#1D2B83] border-none"
            >
              Book Again
            </Button>
          </div>
        }
        className="premium-modal"
        centered
        width={480}
        closeIcon={<div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><XCircle size={16} className="text-slate-500" /></div>}
      >
        {detailModal.item && (() => {
          const item = detailModal.item;
          const subservice = item.subservice_id || item.service_id;
          const refUi = getRefundStatusUI(item.refund_status, item.payment_method);
          const price = item.refund_amount || item.service_price || item.total_amount || 0;
          
          return (
            <div>
              <div className="flex items-center gap-4 border-b border-slate-100 pb-6 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0">
                  <XCircle size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800 leading-tight">
                    {subservice?.subservice_name || subservice?.service_name}
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                    {item.booking_id}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cancelled On</p>
                    <p className="text-sm font-bold text-slate-800">
                      {item.cancelled_at ? new Date(item.cancelled_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Method</p>
                    <p className="text-sm font-bold text-slate-800 uppercase">
                      {item.payment_method || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cancellation Reason</p>
                  <p className="text-sm font-bold text-slate-800">
                    {item.cancellation_reason || 'No reason specified'}
                  </p>
                </div>

                {/* Refund Status */}
                <div className="border border-slate-200 rounded-3xl p-5 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 ${
                    item.payment_method === 'cod' ? 'bg-slate-500' :
                    item.refund_status === 'refunded' ? 'bg-green-500' : 
                    item.refund_status === 'pending' || item.refund_status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Refund Details</p>
                    
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-2xl font-black text-slate-800">₹{price}</p>
                        <Tag color={refUi.color} className="m-0 mt-2 border-none font-bold uppercase tracking-wider text-[9px] px-2 py-0.5">
                          {refUi.text}
                        </Tag>
                      </div>
                      <CreditCard size={32} className="text-slate-200" />
                    </div>

                    {item.payment_method !== 'cod' && (
                      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
                        
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-emerald-500 text-white shadow shrink-0 z-10">
                            <CheckCircle2 size={12} />
                          </div>
                          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded-xl bg-slate-50 border border-slate-100 ml-4 md:ml-0">
                            <p className="font-bold text-slate-800 text-xs">Service Cancelled</p>
                          </div>
                        </div>

                        {['pending', 'processing', 'refunded'].includes(item.refund_status || '') && (
                          <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-yellow-500 text-white shadow shrink-0 z-10">
                              <CheckCircle2 size={12} />
                            </div>
                            <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded-xl bg-slate-50 border border-slate-100 ml-4 md:ml-0">
                              <p className="font-bold text-slate-800 text-xs">Refund Initiated</p>
                            </div>
                          </div>
                        )}

                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                          <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow shrink-0 z-10 ${
                            item.refund_status === 'refunded' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <CheckCircle2 size={12} />
                          </div>
                          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded-xl bg-slate-50 border border-slate-100 ml-4 md:ml-0">
                            <p className={`font-bold text-xs ${item.refund_status === 'refunded' ? 'text-slate-800' : 'text-slate-400'}`}>Refund Processing</p>
                            {item.refund_status !== 'refunded' && <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Est: 2-5 Business Days</p>}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}
      </Modal>

      <style jsx global>{`
        .custom-tabs .ant-tabs-nav::before { border-bottom: none; }
        .custom-tabs .ant-tabs-tab {
          padding: 8px 16px; margin: 0 !important; border-radius: 12px;
          transition: all 0.3s;
        }
        .custom-tabs .ant-tabs-tab-active { background: #1D2B83 !important; }
        .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: white !important; font-weight: 900 !important; text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px;
        }
        .custom-tabs .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn {
          color: #64748b !important; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; font-size: 11px;
        }
        .custom-tabs .ant-tabs-ink-bar { display: none; }
        .premium-modal .ant-modal-content { border-radius: 2rem; padding: 1.5rem; }
        .premium-modal .ant-modal-header { margin-bottom: 1.5rem; border-bottom: none; }
        .premium-modal .ant-modal-close { top: 24px; right: 24px; }
      `}</style>
    </div>
  );
}
