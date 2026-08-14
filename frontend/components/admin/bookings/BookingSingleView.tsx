"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, User, Briefcase, DollarSign, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/config/api';
import BookingDetails from './BookingDetails';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';

interface BookingSingleViewProps {
  bookingId: string;
}

export default function BookingSingleView({ bookingId }: BookingSingleViewProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/bookings/${bookingId}`);
      setBooking(res.data);
    } catch (err: any) {
      console.error('Failed to fetch booking:', err);
      setError(err?.response?.data?.message || 'Booking not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/bookings')}
            className="p-2.5 bg-white/60 hover:bg-white border border-gray-100/80 rounded-xl text-gray-600 hover:text-blue-600 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span>Back to Bookings</span>
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Booking <span className="text-blue-600">#{bookingId}</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              Single Booking View & Management
            </p>
          </div>
        </div>

        {booking && (
          <Button
            onClick={fetchBooking}
            variant="outline"
            size="sm"
            icon={RefreshCw}
            className="bg-white text-xs font-bold"
          >
            Refresh
          </Button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white/40 backdrop-blur-xl p-12 rounded-2xl border border-white/60 shadow-sm flex flex-col items-center justify-center gap-3 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fetching booking records...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="bg-white/40 backdrop-blur-xl p-12 rounded-2xl border border-white/60 shadow-sm flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
            <AlertCircle size={32} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-800">Booking Not Found</h2>
            <p className="text-xs font-medium text-gray-500 mt-1 max-w-md">{error}</p>
          </div>
          <Button onClick={() => router.push('/admin/bookings')} variant="primary" size="sm">
            Return to Bookings List
          </Button>
        </div>
      )}

      {/* Booking Overview Card */}
      {!loading && booking && (
        <div className="bg-white/60 backdrop-blur-xl p-6 rounded-2xl border border-white/80 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
              <div className="mt-1">
                <StatusBadge status={booking.status} />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Payable</p>
              <p className="text-xl font-black text-gray-900 mt-0.5">
                ₹{booking.payable_amount || booking.service_price || 0}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment Status</p>
              {(() => {
                const isPaid = booking.payment_status === 'paid' || (booking.payment_status === 'completed' && booking.status === 'completed');
                const statusLabel = isPaid ? 'PAID' : (booking.payment_status === 'failed' ? 'FAILED' : 'PENDING');
                return (
                  <span className={`inline-block mt-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                    isPaid ? 'bg-emerald-50 text-emerald-600' : (statusLabel === 'FAILED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600')
                  }`}>
                    {statusLabel}
                  </span>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <User size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Customer</p>
                <p className="text-xs font-bold text-gray-900 truncate">{booking.user_id?.name || 'Unknown'}</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Briefcase size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Provider</p>
                <p className="text-xs font-bold text-gray-900 truncate">{booking.provider_id?.user_id?.name || 'Unassigned'}</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                <Briefcase size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Service</p>
                <p className="text-xs font-bold text-gray-900 truncate">
                  {booking.subservice_id?.service_id?.service_name || booking.subservice_id?.name || 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Scheduled Date</p>
                <p className="text-xs font-bold text-gray-900 truncate">
                  {booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Details Modal Popup */}
      {booking && (
        <BookingDetails
          booking={booking}
          onClose={() => router.push('/admin/bookings')}
          onRefresh={fetchBooking}
        />
      )}
    </div>
  );
}
