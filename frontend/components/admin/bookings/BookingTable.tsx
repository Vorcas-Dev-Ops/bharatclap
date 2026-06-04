"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Download, RefreshCw, Calendar, ArrowRight, User, Briefcase, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import Table from '../common/Table';
import StatusBadge from './StatusBadge';
import BookingDetails from './BookingDetails';
import Button from '../common/Button';
import ConfirmationModal from '../common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';

import axios from 'axios';
import { API_URL } from '@/config/api';

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
  const rowsPerPage = 6;

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
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
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/bookings/${pendingUpdate.id}/status`, 
        { status: pendingUpdate.status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh bookings
      fetchBookings();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    } finally {
      setPendingUpdate(null);
    }
  };

  const filtered = bookings.filter(b => {
    const status = b.status?.toLowerCase();
    const matchStatus = statusFilter === 'All' || status === statusFilter.toLowerCase();
    const customerName = b.user_id?.name || '';
    const providerName = b.provider_id?.user_id?.name || 'Unassigned';
    const serviceName = b.subservice_id?.service_id?.service_name || b.subservice_id?.name || '';
    const refId = b._id || '';

    const matchSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Calculate slices
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentOrders = filtered.slice(indexOfFirstRow, indexOfLastRow);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const totals = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed' || b.status === 'accepted').length,
    completed: bookings.filter(b => b.status === 'completed').length,
  };

  const exportToCSV = () => {
    if (!filtered || filtered.length === 0) {
      alert("No data available to export");
      return;
    }

    const headers = ['Ref ID', 'Customer Profile', 'Expert Assigned', 'Service', 'Schedule', 'Cost', 'Status'];
    const csvRows = [headers.join(',')];

    filtered.forEach(booking => {
      // Formatting various fields safely
      const refId = String(booking._id).slice(-6).toUpperCase();
      const customer = booking.user_id?.name || 'Unknown';
      const expert = booking.provider_id?.user_id?.name || 'Unassigned';
      const service = booking.subservice_id?.service_id?.service_name || booking.subservice_id?.name || 'N/A';
      
      const scheduleDate = booking.scheduled_at 
        ? new Date(booking.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
        : 'N/A';
      const scheduleTime = booking.booking_time ? `, ${booking.booking_time}` : '';
      
      // Quotes to avoid commas splitting schedule into multiple columns in excel
      const schedule = `"${scheduleDate}${scheduleTime}"`; 
      
      const cost = booking.payable_amount || booking.service_price || 0;
      const status = booking.status ? booking.status.toUpperCase() : 'UNKNOWN';

      // Ensure strings that might contain commas are quoted
      const row = [
        refId,
        `"${customer}"`,
        `"${expert}"`,
        `"${service}"`,
        schedule,
        cost,
        status
      ];
      
      csvRows.push(row.join(','));
    });

    const csvData = csvRows.join('\n');
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    
    // Generate temporary download link in the browser
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bookings_export_${new Date().getTime()}.csv`);
    
    // Trigger download
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
          <div className="hidden sm:flex items-center gap-4 bg-white/40 backdrop-blur-xl p-2 px-5 border border-white/60 rounded-xl shadow-sm">
            <div className="text-center">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">Active</p>
              <p className="text-xs font-black text-gray-900 mt-1">{totals.confirmed + totals.pending}</p>
            </div>
            <div className="w-px h-4 bg-gray-100" />
            <div className="text-center">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest leading-none">Done</p>
              <p className="text-xs font-black text-gray-900 mt-1">{totals.completed}</p>
            </div>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm" icon={Download} className="shadow-sm bg-white border-gray-100 text-[11px]">Export CSV</Button>
        </div>
      </div>

      {/* Dynamic Filter Bar */}
      <div className="bg-white/40 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-auto md:min-w-[400px] group">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by ID, customer, expert, or service..."
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
              <option value="confirmed">🔵 Confirmed</option>
              <option value="accepted">🔵 Accepted</option>
              <option value="in_progress">🟣 In Progress</option>
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
            headers={['Ref ID', 'Customer Profile', 'Expert Assigned', 'Service', 'Schedule', 'Cost', 'Status']}
            className="relative z-10"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {currentOrders.length > 0 ? (
                currentOrders.map((booking) => (
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
                      <span className="px-2 py-1 bg-blue-50 rounded-md border border-blue-100/50">{String(booking._id).slice(-6).toUpperCase()}</span>
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
                    <td className="px-6 py-3 font-black text-gray-900 tracking-tighter text-[12px]">₹{booking.payable_amount || booking.service_price || 0}</td>
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
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center">
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

      <BookingDetails booking={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default BookingTable;
