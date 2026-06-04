"use client";

import React, { useState, useEffect } from "react";
import { API_URL, BACKEND_URL } from "@/config/api";
import Navbar from "@/components/common/Navbar";
import { Tabs, Button } from "antd";
import {
  RefreshCcw,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Calendar as CalendarIcon,
  HelpCircle,
  Download,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Headphones,
  Info
} from "lucide-react";
import { message } from "antd";
import Link from "next/link";

interface Booking {
  _id: string;
  booking_id: string;
  subservice_id: any;
  service_id?: any;
  payable_amount: number;
  total_amount?: number;
  service_price?: number;
  status: string;
  refund_status?: string;
  refund_amount?: number;
  refund_id?: string;
  refund_processed_at?: string;
  cancelled_at?: string;
  address_id?: any;
  scheduled_at: string;
  booking_time: string;
}

const CancellationsPage = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    fetchCancellations();
  }, []);

  const fetchCancellations = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      let allBookings = [];
      if (Array.isArray(data)) {
        allBookings = data;
      } else if (data.bookings && Array.isArray(data.bookings)) {
        allBookings = data.bookings;
      }

      const cancelled = allBookings.filter(b => ["cancelled", "rejected"].includes(b.status));
      setBookings(cancelled);
    } catch (err) {
      messageApi.error("Failed to load your cancellations");
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBookings = () => {
    if (activeTab === "all") return bookings;
    if (activeTab === "cancelled") return bookings.filter(b => b.refund_status === "none" || !b.refund_status);
    if (activeTab === "processing") return bookings.filter(b => ["initiated", "processing"].includes(b.refund_status || ""));
    if (activeTab === "refunded") return bookings.filter(b => b.refund_status === "completed");
    if (activeTab === "failed") return bookings.filter(b => b.refund_status === "failed");
    return bookings;
  };

  const renderTimeline = (booking: Booking) => {
    const rStatus = booking.refund_status || "initiated";
    const statuses = ['initiated', 'processing', 'completed'];
    let currentIdx = statuses.indexOf(rStatus);
    if (rStatus === 'none' || rStatus === 'failed') currentIdx = -1;

    const cancelledDate = booking.cancelled_at ? new Date(booking.cancelled_at) : new Date();

    return (
      <div className="flex flex-col gap-4 relative">
        <div className="absolute left-2.5 top-3 bottom-4 w-0.5 bg-slate-100 z-0" />

        {/* Cancelled Step */}
        <div className="flex items-start gap-3 relative z-10">
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 leading-none mb-1">Cancelled</p>
            <p className="text-[10px] font-medium text-slate-400">
              {cancelledDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {cancelledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {rStatus === 'failed' ? (
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
              <XCircle size={18} className="text-rose-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-none mb-1">Refund Failed</p>
              <p className="text-[10px] font-medium text-rose-500">Contact Support</p>
            </div>
          </div>
        ) : (
          <>
            {/* Initiated Step */}
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
                {currentIdx >= 0 ? <CheckCircle2 size={18} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
              </div>
              <div>
                <p className={`text-xs font-bold leading-none mb-1 ${currentIdx >= 0 ? 'text-slate-800' : 'text-slate-400'}`}>Refund Initiated</p>
                {currentIdx >= 0 && <p className="text-[10px] font-medium text-slate-400">Processing with bank</p>}
              </div>
            </div>

            {/* Processing Step */}
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
                {currentIdx >= 1 ? <CheckCircle2 size={18} className="text-emerald-500" /> : (currentIdx === 0 ? <Clock size={18} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />)}
              </div>
              <div>
                <p className={`text-xs font-bold leading-none mb-1 ${currentIdx >= 1 || currentIdx === 0 ? 'text-slate-800' : 'text-slate-400'}`}>Refund Processing</p>
              </div>
            </div>

            {/* Completed Step */}
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5">
                {currentIdx >= 2 ? <CheckCircle2 size={18} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
              </div>
              <div>
                <p className={`text-xs font-bold leading-none mb-1 ${currentIdx >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>Refund Completed</p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-50/50 flex flex-col overflow-hidden">
      {contextHolder}
      <Navbar />

      <div className="flex-1 max-w-[1500px] w-full mx-auto px-4 lg:px-8 pt-[30px] pb-4 flex flex-col lg:flex-row gap-8 lg:gap-12 overflow-hidden">

        {/* Left Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

          {/* Fixed Header & Tabs for Left Area */}
          <div className="shrink-0">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Refunds & Cancellations</h1>
            </div>

            <div className="mb-4 border-b border-slate-200">
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                className="custom-tabs"
                items={[
                  { key: 'all', label: 'All' },
                  { key: 'cancelled', label: 'Cancelled' },
                  { key: 'processing', label: 'Refund Processing' },
                  { key: 'refunded', label: 'Refunded' },
                  { key: 'failed', label: 'Failed' },
                ]}
              />
            </div>
          </div>

          {/* Scrollable Booking Cards Area */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-pulse">
                    <div className="h-32 bg-slate-50 rounded-2xl w-full" />
                  </div>
                ))}
              </div>
            ) : getFilteredBookings().length === 0 ? (
              <div className="bg-white rounded-[3rem] p-16 text-center shadow-sm border border-slate-100 mt-6">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <RefreshCcw className="text-blue-400" size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Records Found</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-sm mx-auto">
                  You have no cancelled bookings matching this status.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {getFilteredBookings().map((booking) => {
                  const subservice = booking.subservice_id || booking.service_id;
                  const imageUrl = subservice?.image ? (subservice.image.startsWith('http') ? subservice.image : `${BACKEND_URL}${subservice.image}`) : null;
                  const paidAmt = booking.payable_amount || booking.service_price || booking.total_amount || 0;
                  const refundAmount = booking.refund_amount || Math.max(0, paidAmt - 30);

                  const cancelledDate = booking.cancelled_at ? new Date(booking.cancelled_at) : new Date();
                  const expectedDate = new Date(cancelledDate);
                  expectedDate.setDate(expectedDate.getDate() + 7);

                  const rStatus = booking.refund_status || "initiated";
                  const isFailed = rStatus === 'failed';
                  const isRefunded = rStatus === 'completed';

                  return (
                    <div key={booking._id} className="bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all overflow-hidden">
                      <div className="p-6 relative">
                        <div className="flex flex-col md:flex-row gap-6">

                          {/* Column 1: Image & Basic Info */}
                          <div className="md:w-[30%] flex flex-col justify-between">
                            <div className="flex gap-4">
                              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex-shrink-0">
                                {imageUrl ? (
                                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300"><Info size={24} /></div>
                                )}
                              </div>
                              <div className="flex flex-col pt-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <XCircle size={10} /> Cancelled
                                  </span>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-1.5 py-0.5 rounded">
                                    {booking.booking_id}
                                  </span>
                                </div>
                                <h3 className="text-base font-black text-slate-800 leading-tight mb-2.5">{subservice?.subservice_name || subservice?.service_name}</h3>
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                    <CalendarIcon size={12} className="text-slate-400" />
                                    {new Date(booking.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, {booking.booking_time}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 truncate max-w-[180px]">
                                    <MapPin size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className="truncate">{booking.address_id?.address_line || booking.address_id?.city || 'Bangalore'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Button className="mt-6 w-max rounded-lg font-bold text-xs h-8 px-4 flex items-center gap-2 border-slate-200 text-slate-600">
                              <span className="opacity-70">📄</span> View Details
                            </Button>
                          </div>

                          {/* Column 2: Amounts */}
                          <div className="md:w-[20%] flex flex-col pt-1">
                            <div className="mb-6">
                              <p className="text-[10px] font-bold text-slate-500 mb-1">Refund Amount</p>
                              <p className="text-2xl font-black text-[#1D2B83]">₹{refundAmount}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 mb-1">Paid Amount</p>
                              <p className="text-sm font-bold text-slate-600">₹{paidAmt}</p>
                            </div>
                          </div>

                          {/* Column 3: Status Details */}
                          <div className="md:w-[20%] flex flex-col pt-1">
                            <div className="mb-4">
                              <p className="text-[10px] font-bold text-slate-500 mb-1">Status</p>
                              <p className={`text-sm font-black capitalize ${isRefunded ? 'text-emerald-500' : isFailed ? 'text-rose-500' : 'text-amber-500'
                                }`}>
                                {rStatus === 'none' ? 'Processing' : rStatus}
                              </p>
                            </div>

                            {isRefunded ? (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Refunded On</p>
                                  <p className="text-xs font-bold text-slate-800">{booking.refund_processed_at ? new Date(booking.refund_processed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Refund ID</p>
                                  <p className="text-xs font-bold text-slate-800">{booking.refund_id || `RFN${Math.floor(10000000 + Math.random() * 90000000)}`}</p>
                                </div>
                              </div>
                            ) : isFailed ? (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Refund Attempted On</p>
                                  <p className="text-xs font-bold text-rose-600">{expectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Reason</p>
                                  <p className="text-xs font-bold text-slate-800">Bank Rejected</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Refund Initiated</p>
                                  <p className="text-xs font-bold text-slate-800">{cancelledDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 mb-1">Expected By</p>
                                  <p className="text-xs font-bold text-slate-800">{expectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Column 4: Timeline */}
                          <div className="md:w-[30%] flex flex-col border-l border-slate-100 pl-8 relative">
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-6">STATUS TIMELINE</p>
                            {renderTimeline(booking)}

                            {/* Floating Footer Action positioned at bottom right */}
                            <div className="absolute bottom-0 right-0">
                              {isFailed ? (
                                <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                  Try Again <RefreshCcw size={14} />
                                </button>
                              ) : isRefunded ? (
                                <button className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                  <Download size={14} /> Download Receipt
                                </button>
                              ) : (
                                <Link href="/user/support" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                  <Headphones size={14} /> Need Help?
                                </Link>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Policies */}
        <div className="w-full lg:w-[340px] shrink-0 h-full overflow-hidden">
          <div className="space-y-4">
            {/* Cancellation Policy */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center">
                  <ShieldCheck size={14} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-slate-800">Cancellation & Refund Policy</h3>
                  <p className="text-[9px] font-medium text-slate-500 mt-0.5 leading-tight">Please read our cancellation and refund policy.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2.5 px-3 py-2 bg-emerald-50/50 rounded-xl border border-emerald-50 items-center">
                  <Clock size={12} className="text-emerald-500 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-800 leading-none mb-1">Before Provider Assignment</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-none">Full refund will be provided.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3 py-2 bg-blue-50/50 rounded-xl border border-blue-50 items-center">
                  <Clock size={12} className="text-blue-500 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-800 leading-none mb-1">More than 24 Hours Before Slot</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-none">100% refund of the service amount.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3 py-2 bg-amber-50/50 rounded-xl border border-amber-50 items-center">
                  <Clock size={12} className="text-amber-500 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-800 leading-none mb-1">Between 2 to 24 Hours</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-none">80% refund after deducting cancellation fee.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3 py-2 bg-rose-50/50 rounded-xl border border-rose-50 items-center">
                  <Clock size={12} className="text-rose-500 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-800 leading-none mb-1">Less than 2 Hours</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-none">50% refund after deducting cancellation fee.</p>
                  </div>
                </div>
                <div className="flex gap-2.5 px-3 py-2 bg-rose-50/80 rounded-xl border border-rose-100 items-center">
                  <XCircle size={12} className="text-rose-600 shrink-0" />
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-slate-800 leading-none mb-1">After Provider On the Way</p>
                    <p className="text-[9px] text-slate-500 font-medium leading-none">No refund applicable.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
              <h3 className="text-[12px] font-black text-slate-800 mb-2">Important Notes</h3>
              <ul className="space-y-1.5 text-[9px] font-medium text-slate-600 list-disc pl-4 leading-tight">
                <li>Refunds will be credited to your original payment method.</li>
                <li>It may take 3-7 business days for the amount to reflect in your account.</li>
                <li>Coupons and offers are non-refundable.</li>
                <li>For any issues, contact our support team.</li>
              </ul>
            </div>

            {/* Support */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Headphones size={14} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="text-[12px] font-black text-slate-800 leading-tight">Need Help?</h3>
                  <p className="text-[9px] text-slate-500 font-medium leading-tight mt-0.5">Our support team is here to help you.</p>
                  <Link href="/user/support" className="flex items-center w-max gap-1 text-[10px] font-bold text-blue-600 mt-0.5 hover:text-blue-700">
                    Contact Support <ChevronRight size={10} />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-tabs .ant-tabs-nav::before {
          border-bottom: none;
        }
        .custom-tabs .ant-tabs-tab {
          padding: 8px 16px;
          margin: 0 4px !important;
          border-radius: 12px;
          transition: all 0.3s;
        }
        .custom-tabs .ant-tabs-tab-active {
          background: transparent !important;
        }
        .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1D2B83 !important;
          font-weight: 900 !important;
        }
        .custom-tabs .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn {
          color: #64748b !important;
          font-weight: 600;
        }
        .custom-tabs .ant-tabs-ink-bar {
          background: #1D2B83;
          height: 3px !important;
          border-radius: 3px 3px 0 0;
        }
      `}</style>
    </div>
  );
};

export default CancellationsPage;
