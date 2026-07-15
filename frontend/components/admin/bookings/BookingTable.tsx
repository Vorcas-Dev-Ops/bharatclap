"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Download, RefreshCw, Calendar, ArrowRight, User, Briefcase, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Table from '../common/Table';
import StatusBadge from './StatusBadge';
import BookingDetails from './BookingDetails';
import Button from '../common/Button';
import ConfirmationModal from '../common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

import { API_URL, apiClient } from '@/config/api';

const BookingTable: React.FC = () => {
  const [selected, setSelected] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Confirmation Modal State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string, status: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const rowsPerPage = 6;

  useEffect(() => {
    // Handle redirect params from dashboard stuck widget
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      const searchParam = params.get('search');
      if (filterParam) setStatusFilter(filterParam);
      if (searchParam) setSearchTerm(searchParam);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [currentPage, statusFilter, searchTerm]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      let queryStatus = statusFilter;
      if (statusFilter === 'All') queryStatus = '';
      else if (statusFilter === 'Searching') queryStatus = 'provider_searching';
      else if (statusFilter === 'OTP Pending') queryStatus = 'waiting_start_otp';
      else if (statusFilter === 'In Progress') queryStatus = 'in_progress';
      else if (statusFilter === 'Waiting End OTP') queryStatus = 'waiting_end_otp';
      else if (statusFilter === 'Completed') queryStatus = 'completed';
      else if (statusFilter === 'Cancelled') queryStatus = 'cancelled';
      else if (statusFilter.toLowerCase() !== 'all') queryStatus = statusFilter;

      const response = await apiClient.get(`/bookings`, {
        params: {
          page: currentPage,
          limit: rowsPerPage,
          status: queryStatus === 'All' ? '' : queryStatus,
          search: searchTerm
        }
      });
      
      // Handle both raw array and paginated { data: [] } response shapes
      const bookingData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const total = Array.isArray(response.data) ? response.data.length : (response.data?.total || 0);
      setBookings(bookingData);
      setTotalRows(total);
      setTotalPages(response.data?.pages || Math.ceil(total / rowsPerPage) || 1);
    } catch (error: any) {
      if (error?.response?.status !== 401 && error?.response?.status !== 403) {
        console.error('Error fetching bookings:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChangeClick = (bookingId: string, newStatus: string, currentStatus: string) => {
    if (newStatus === currentStatus) return;
    setPendingUpdate({ id: bookingId, status: newStatus });
    setIsConfirmOpen(true);
  };

  const confirmStatusUpdate = async () => {
    if (!pendingUpdate) return;
    try {
      await apiClient.put(`/bookings/${pendingUpdate.id}/status`, 
        { status: pendingUpdate.status }
      );
      fetchBookings();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setPendingUpdate(null);
    }
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm]);

  const totals = {
    confirmed: bookings.filter(b => b.status === 'accepted').length,
    pending: bookings.filter(b => b.status === 'pending' || b.status === 'provider_searching').length,
    completed: bookings.filter(b => b.status === 'completed').length
  };

  const exportToCSV = () => {
    const csvRows = [];
    const headers = ['Booking ID', 'Customer', 'Provider', 'Service', 'Scheduled Time', 'Payment Status', 'Booking Status', 'Current Stage', 'Created At'];
    csvRows.push(headers.join(','));

    bookings.forEach(b => {
      const row = [
        b.booking_id || b._id,
        `"${b.user_id?.name || 'Unknown'}"`,
        `"${b.provider_id?.user_id?.name || 'Unassigned'}"`,
        `"${b.subservice_id?.service_id?.service_name || b.subservice_id?.name || 'N/A'}"`,
        `"${b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString() : ''}"`,
        b.payment_status || 'unpaid',
        b.status,
        b.status === 'waiting_start_otp' ? 'Waiting Start OTP' : b.status === 'waiting_end_otp' ? 'Waiting End OTP' : b.status,
        `"${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bookings_export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={confirmStatusUpdate}
        title="Change Booking Status"
        message={`Are you sure you want to change the booking status to ${pendingUpdate?.status}? This action will update the platform records.`}
        variant="warning"
        confirmLabel="Update Status"
      />

      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Platform <span className="text-blue-600">Bookings</span></h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={exportToCSV} variant="outline" size="sm" icon={Download} className="shadow-sm bg-white border-gray-100 text-[11px]">Export CSV</Button>
        </div>
      </div>

      {/* Dynamic Filter Bar */}
      <div className="bg-white/40 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto md:min-w-[400px] group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID, customer, provider, or service..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-100 focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-100/50 rounded-xl text-[11px] font-bold text-gray-800 transition-all duration-300 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative group flex-1 md:flex-none">
            <Filter size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-10 py-2.5 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-600 appearance-none focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-100/50 shadow-sm cursor-pointer w-full md:min-w-[180px] transition-all"
            >
              <option value="All">Filter By Status</option>
              <option value="pending">🟡 Pending</option>
              <option value="provider_searching">🔍 Provider Searching</option>
              <option value="accepted">🔵 Accepted</option>
              <option value="waiting_start_otp">🟡 Waiting Start OTP</option>
              <option value="in_progress">🟣 In Progress</option>
              <option value="waiting_end_otp">🟡 Waiting End OTP</option>
              <option value="completed">🟢 Completed</option>
              <option value="cancelled">🔴 Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Layer */}
      <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden group min-h-[460px] flex flex-col">
        <div className="flex-1">
          <Table
            headers={['Booking ID', 'Customer', 'Provider', 'Service', 'Scheduled Time', 'Payment Status', 'Booking Status', 'Current Stage', 'Created At']}
            className="relative z-10"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {bookings.length > 0 ? (
                bookings.map((booking) => (
                  <motion.tr
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    key={booking._id}
                    className="hover:bg-blue-50/20 transition-all group/row border-b border-gray-50 last:border-0 text-[11px]"
                  >
                    <td 
                      className="px-6 py-3 font-black text-[9px] text-blue-600 tracking-widest leading-none cursor-pointer"
                      onClick={() => setSelected(booking)}
                    >
                      <span className="px-2 py-1 bg-blue-50 rounded-md border border-blue-100/50">{booking.booking_id || String(booking._id).slice(-6).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-3 cursor-pointer" onClick={() => setSelected(booking)}>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shadow-sm overflow-hidden transition-transform group-hover/row:scale-110">
                           {booking.user_id?.profile_image ? (
                             <img src={booking.user_id.profile_image} alt="user" className="w-full h-full object-cover" />
                           ) : (
                             <User size={14} />
                           )}
                        </div>
                        <span className="font-black text-gray-900 uppercase tracking-tight">{booking.user_id?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 cursor-pointer" onClick={() => setSelected(booking)}>
                      <div className="flex items-center gap-2 text-gray-500 font-bold uppercase text-[9px] tracking-widest">
                        <Briefcase size={12} className="text-gray-400" />
                        {booking.provider_id?.user_id?.name || 'Unassigned'}
                      </div>
                    </td>
                    <td className="px-6 py-3 cursor-pointer" onClick={() => setSelected(booking)}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-100/50 w-fit">
                          {booking.subservice_id?.service_id?.service_name || booking.subservice_id?.name || 'N/A'}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400">{booking.subservice_id?.service_id?.category_id?.category_name || ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 cursor-pointer" onClick={() => setSelected(booking)}>
                      <div className="flex items-center gap-1.5 text-gray-400 font-black text-[9px] uppercase tracking-widest">
                        <Calendar size={12} />
                        {booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                        {booking.booking_time ? `, ${booking.booking_time}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-3 cursor-pointer font-black text-[10px] uppercase tracking-widest" onClick={() => setSelected(booking)}>
                      <span className={`px-2 py-1 rounded ${booking.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {booking.payment_status || 'unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-3 cursor-pointer" onClick={() => setSelected(booking)}>
                      <span
                        className={`
                          inline-block px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-widest text-center shadow-sm min-w-[80px]
                          ${booking.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                            booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                            booking.status === 'cancelled' || booking.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                            'bg-blue-50 text-blue-600 border-blue-200'}
                        `}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 cursor-pointer text-gray-500 font-bold uppercase text-[9px] tracking-widest" onClick={() => setSelected(booking)}>
                      {booking.status === 'waiting_start_otp' ? 'Waiting Start OTP' :
                       booking.status === 'waiting_end_otp' ? 'Waiting End OTP' :
                       booking.status === 'in_progress' ? 'Service Started' :
                       booking.status === 'completed' ? 'Completed' :
                       booking.status === 'accepted' ? 'Accepted' :
                       booking.status === 'provider_searching' ? 'Searching Provider' : booking.status}
                    </td>
                    <td className="px-6 py-3 cursor-pointer text-gray-400 font-black text-[9px] uppercase tracking-widest" onClick={() => setSelected(booking)}>
                      {booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-30">
                      <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                        <Calendar size={48} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">Zero matches recorded</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Adjust filters for a different view</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </Table>
        </div>

        {/* Footer Layer */}
        <div className="p-5 border-t border-white/20 bg-white/10 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 disabled:opacity-30 shadow-sm transition-all"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${currentPage === page
                      ? "bg-blue-600 text-white border-blue-600 shadow-blue-600/20"
                      : "bg-white text-gray-400 border-gray-100 hover:border-blue-200"
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 disabled:opacity-30 shadow-sm transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <BookingDetails booking={selected} onClose={() => setSelected(null)} onRefresh={fetchBookings} />
    </div>
  );
};

export default BookingTable;
