"use client";

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import StatusBadge from './StatusBadge';
import { User, Briefcase, Calendar, DollarSign, Hash, ShieldAlert, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface BookingDetailsProps {
  booking: any | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const BookingDetails: React.FC<BookingDetailsProps> = ({ booking, onClose, onRefresh }) => {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [dispatchHistory, setDispatchHistory] = useState<any[]>([]);
  const [loadingDispatch, setLoadingDispatch] = useState(false);

  useEffect(() => {
    if (booking?._id) {
      fetchActivities();
      fetchDispatchHistory();
    }
  }, [booking]);

  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/bookings/${booking._id}/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActivities(res.data || []);
    } catch (e) {
      console.error('Error fetching booking activity logs:', e);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchDispatchHistory = async () => {
    try {
      setLoadingDispatch(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/providers/dispatch-history/${booking._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDispatchHistory(res.data || []);
    } catch (e) {
      console.error('Error fetching dispatch history:', e);
    } finally {
      setLoadingDispatch(false);
    }
  };

  if (!booking) return null;

  const handleRedispatch = async () => {
    if (!booking) return;
    setLoadingAction('redispatch');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/bookings/debug-redispatch`, {
        booking_id: booking.booking_id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Re-dispatch triggered: ' + JSON.stringify(res.data.dispatch_results || res.data));
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Failed to re-dispatch: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceCancel = async () => {
    if (!booking) return;
    setLoadingAction('cancel');
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/bookings/${booking._id}/status`, {
        status: 'cancelled'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Booking cancelled successfully');
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Failed to cancel: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoadingAction(null);
    }
  };

  const handleForceTransition = async (targetStatus: string) => {
    if (!booking) return;
    setLoadingAction(targetStatus);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/bookings/${booking._id}/status`, {
        status: targetStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`Booking transitioned to ${targetStatus} successfully`);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to transition to ${targetStatus}: ` + (err.response?.data?.message || err.message));
    } finally {
      setLoadingAction(null);
    }
  };

  const fields = [
    { icon: Hash,       label: 'Booking ID', value: booking.booking_id || (booking._id ? String(booking._id).slice(-6).toUpperCase() : '') },
    { icon: User,       label: 'Customer',   value: booking.user_id?.name || 'Unknown' },
    { icon: Briefcase,  label: 'Provider',   value: booking.provider_id?.user_id?.name 
        ? `${booking.provider_id.user_id.name} (${booking.provider_id.availability_status || 'offline'})` 
        : 'Unassigned' },
    { icon: Briefcase,  label: 'Service',    value: booking.subservice_id?.service_id?.service_name || booking.subservice_id?.name || 'N/A' },
    { icon: Calendar,   label: 'Date',       value: `${booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleDateString() : 'N/A'} ${booking.booking_time || ''}` },
    { icon: DollarSign, label: 'Amount',     value: `₹${booking.payable_amount || booking.service_price || 0}` },
  ];

  const showCommission = booking.status === 'completed' || booking.commission_percentage != null;

  return (
    <Modal
      isOpen={!!booking}
      onClose={onClose}
      title="Booking Details & Operations"
      size="md"
      footer={<Button variant="outline" size="sm" onClick={onClose}>Close</Button>}
    >
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
              <StatusBadge status={booking.status} />
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 font-medium mb-1">Total Payable</p>
              <span className="text-xl font-bold text-gray-900">₹{booking.payable_amount || booking.service_price || 0}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">General Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fields.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100/50">
                  <div className="p-2 bg-white rounded-lg border border-gray-100 shadow-sm flex-shrink-0">
                    <Icon size={15} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium leading-none mb-1">{label}</p>
                    <p className="text-xs text-gray-800 font-bold truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* OTP Status Checkpoints */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">OTP Checkpoints</h3>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-2 gap-4 text-xs font-bold">
              <div>
                <span className="text-gray-400 block mb-1 text-[10px] uppercase">Start OTP Status</span>
                <span className={booking.startOtpVerified ? "text-emerald-600" : "text-amber-600"}>
                  {booking.startOtpVerified ? "✓ Verified" : (booking.startOtpGeneratedAt ? "Generated (Pending)" : "Not Generated")}
                </span>
                {booking.startOtpAttempts > 0 && !booking.startOtpVerified && (
                  <span className="text-[9px] text-gray-400 block mt-0.5 font-medium">Attempts: {booking.startOtpAttempts}/5</span>
                )}
              </div>
              <div>
                <span className="text-gray-400 block mb-1 text-[10px] uppercase">End OTP Status</span>
                <span className={booking.endOtpVerified ? "text-emerald-600" : "text-amber-600"}>
                  {booking.endOtpVerified ? "✓ Verified" : (booking.endOtpGeneratedAt ? "Generated (Pending)" : "Not Generated")}
                </span>
                {booking.endOtpAttempts > 0 && !booking.endOtpVerified && (
                  <span className="text-[9px] text-gray-400 block mt-0.5 font-medium">Attempts: {booking.endOtpAttempts}/5</span>
                )}
              </div>
            </div>
          </div>

          {/* Payment & Payouts */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Payment & Commission</h3>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Status</span>
                <span className="font-bold uppercase tracking-wider text-blue-600">{booking.payment_status || 'Pending'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-bold uppercase tracking-wider text-gray-700">{booking.payment_method || 'Online'}</span>
              </div>
              {showCommission && (
                <>
                  <div className="border-t border-gray-200/50 pt-2 flex justify-between">
                    <span className="text-gray-500">Commission Rate</span>
                    <span className="font-bold text-gray-700">{booking.commission_percentage ?? 15}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Commission Cut</span>
                    <span className="font-bold text-red-600">₹{booking.commission_amount ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200">
                    <span className="text-gray-800">Partner Payout</span>
                    <span className="text-green-600">₹{booking.provider_payout ?? 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dispatch attempts history */}
          {dispatchHistory.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Dispatch History</h3>
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-left border-collapse text-[10px] font-bold text-gray-500">
                  <thead>
                    <tr className="border-b border-gray-200/50 pb-2">
                      <th className="pb-2 font-black text-gray-400 uppercase tracking-wider">Expert</th>
                      <th className="pb-2 font-black text-gray-400 uppercase tracking-wider">Rank</th>
                      <th className="pb-2 font-black text-gray-400 uppercase tracking-wider">Distance</th>
                      <th className="pb-2 font-black text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatchHistory.map((jr, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-100/50">
                        <td className="py-2 text-gray-800">{jr.provider_name}</td>
                        <td className="py-2 text-gray-400">#{jr.provider_rank}</td>
                        <td className="py-2 text-gray-400">{jr.distance}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-widest ${
                            jr.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                            jr.status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {jr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lifecycle timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Lifecycle Timeline</h3>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
              {loadingActivities ? (
                <p className="text-[10px] text-gray-400">Loading timeline...</p>
              ) : activities.length > 0 ? (
                activities.map((act, idx) => (
                  <div key={idx} className="flex gap-3 items-start relative">
                    {idx !== activities.length - 1 && (
                      <div className="absolute left-[7px] top-[14px] bottom-[-20px] w-[2px] bg-blue-100" />
                    )}
                    <div className="w-4 h-4 rounded-full bg-blue-500 border-4 border-white flex-shrink-0 z-10 shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                          {act.action.replace(/_/g, ' ')}
                        </p>
                        <span className="text-[9px] text-gray-400 font-bold whitespace-nowrap">
                          {new Date(act.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        by <span className="font-bold text-gray-500 uppercase">{act.actor}</span>
                      </p>
                      {act.details && Object.keys(act.details).length > 0 && (
                        <div className="mt-1.5 p-2 bg-white border border-gray-100 rounded-lg text-[9px] text-gray-500 space-y-0.5 font-semibold">
                          {Object.entries(act.details).map(([key, val]: any) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}:</span>
                              <span>{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-gray-400">No activity logged yet.</p>
              )}
            </div>
          </div>

          {/* Actions for stuck bookings */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Operator Actions</h3>
            <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100/50 flex flex-wrap gap-2">
              {/* Show Re-dispatch if stuck */}
              {(booking.status === 'provider_searching' || booking.status === 'pending' || booking.status === 'accepted') && (
                <Button 
                  variant="outline" 
                  size="xs" 
                  icon={RefreshCw}
                  onClick={handleRedispatch} 
                  isLoading={loadingAction === 'redispatch'}
                >
                  Re-dispatch Job
                </Button>
              )}

              {/* Show Force Cancel if booking isn't ended */}
              {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <Button 
                  variant="danger" 
                  size="xs" 
                  icon={ShieldAlert}
                  onClick={handleForceCancel} 
                  isLoading={loadingAction === 'cancel'}
                >
                  Force Cancel
                </Button>
              )}

              {/* Show Force transition to In Progress if stuck waiting start OTP */}
              {booking.status === 'waiting_start_otp' && (
                <Button 
                  variant="success" 
                  size="xs" 
                  onClick={() => handleForceTransition('in_progress')} 
                  isLoading={loadingAction === 'in_progress'}
                >
                  Bypass OTP (Force Start)
                </Button>
              )}

              {/* Show Force transition to Completed if stuck waiting end OTP */}
              {booking.status === 'waiting_end_otp' && (
                <Button 
                  variant="success" 
                  size="xs" 
                  onClick={() => handleForceTransition('completed')} 
                  isLoading={loadingAction === 'completed'}
                >
                  Bypass OTP (Force Complete)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BookingDetails;
