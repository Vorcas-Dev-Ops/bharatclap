"use client";

import React, { useState, useEffect } from "react";
import BookingDetailModal from "@/components/provider/modals/BookingDetailModal";
import { JourneyConfirmationModal } from "@/components/provider/modals/JourneyConfirmationModal";
import { API_URL, apiClient } from "@/config/api";
import { connectSocket } from "@/services/socket";
import { message } from "antd";
import {
  Search,
  Filter,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Check,
  X,
  ChevronRight,
  User,
  MoreVertical,
  AlertCircle,
  Navigation,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";

const tabs = ["Provider Searching", "Accepted", "In Progress", "Completed"];

// const bookings = [
//   {
//     id: "BK-9821",
//     customer: "Priya Singh",
//     service: "Deep Home Cleaning",
//     dateTime: "15 May, 10:00 AM",
//     address: "B-402, Sunshine Apartments, Sector 45, Gurgaon",
//     amount: "₹2,499",
//     status: "Pending",
//     phone: "+91 98765 43210",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya"
//   },
//   {
//     id: "BK-9815",
//     customer: "Rahul Verma",
//     service: "AC Service",
//     dateTime: "14 May, 02:30 PM",
//     address: "H.No 124, Pocket C, Sarita Vihar, Delhi",
//     amount: "₹899",
//     status: "Accepted",
//     phone: "+91 99887 76655",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul"
//   },
//   {
//     id: "BK-9810",
//     customer: "Amit Kumar",
//     service: "Bathroom Cleaning",
//     dateTime: "12 May, 11:00 AM",
//     address: "Flat 12, Tower 2, DLF Phase 3, Gurgaon",
//     amount: "₹1,200",
//     status: "Completed",
//     phone: "+91 95554 33221",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amit"
//   }
// ];

export default function BookingsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState("Provider Searching");
  const [bookings, setBookings] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem("provider_bookings_cache");
      if (cached) {
        try { return JSON.parse(cached); } catch (_) {}
      }
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem("provider_bookings_cache");
    }
    return true;
  });
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Journey Confirmation Modal State
  const [journeyModalBooking, setJourneyModalBooking] = useState<any>(null);

  // Smart polling & Socket state
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetchingRef = React.useRef(false);

  // OTP Modal State
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpBooking, setOtpBooking] = useState<any>(null);
  const [otpType, setOtpType] = useState<'start' | 'end'>('start');
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    let isSocketConnected = false;
    let pollTimer: NodeJS.Timeout | null = null;
    let backoffDelay = 5000;
    let socketInstance: any = null;

    const handleSocketUpdate = () => {
      fetchBookings(page, true);
    };

    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user && user._id) {
          socketInstance = connectSocket(user._id, 'provider');

          socketInstance.on('connect', () => { isSocketConnected = true; });
          socketInstance.on('disconnect', () => { isSocketConnected = false; });
          socketInstance.on('new_job_request', handleSocketUpdate);
          socketInstance.on('booking_status_update', handleSocketUpdate);
          socketInstance.on('booking_status_updated', handleSocketUpdate);
          socketInstance.on('job_request_expired', handleSocketUpdate);
          socketInstance.on('booking_assigned', handleSocketUpdate);
        }
      } catch (_) {}
    }

    // Auto-sync bookings and job requests every 3 seconds in background
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchBookings(page, true);
      }
    }, 3000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchBookings(page, true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (socketInstance) {
        socketInstance.off('new_job_request', handleSocketUpdate);
        socketInstance.off('booking_status_update', handleSocketUpdate);
        socketInstance.off('booking_status_updated', handleSocketUpdate);
        socketInstance.off('job_request_expired', handleSocketUpdate);
        socketInstance.off('booking_assigned', handleSocketUpdate);
      }
    };
  }, [page]);

  const fetchBookings = async (pageToFetch = 1, isBackground = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      if (!isBackground && bookings.length === 0) setLoading(true);
      setError(null);

      let bookingsRes: any = null;
      let requestsRes: any = null;
      let bookingsError = null;
      let requestsError = null;

      const [bookingsResult, requestsResult] = await Promise.allSettled([
        apiClient.get(`/bookings/my`, { params: { page: pageToFetch, limit: 10 } }),
        apiClient.get(`/providers/job-requests`)
      ]);

      if (bookingsResult.status === 'fulfilled') {
        bookingsRes = bookingsResult.value;
      } else {
        bookingsError = bookingsResult.reason?.response?.data?.message || bookingsResult.reason?.message;
      }

      if (requestsResult.status === 'fulfilled') {
        requestsRes = requestsResult.value;
      } else {
        requestsError = requestsResult.reason?.response?.data?.message || requestsResult.reason?.message;
      }

      if (bookingsError && requestsError) {
        if (bookings.length === 0) {
          setError(`Failed to load data. Bookings Error: ${bookingsError}. Job Requests Error: ${requestsError}`);
        }
        messageApi.error("Failed to load bookings and job requests.");
        return;
      } else if (bookingsError) {
        messageApi.warning(`Failed to load bookings history: ${bookingsError}`);
      } else if (requestsError) {
        messageApi.warning(`Failed to load job requests: ${requestsError}`);
      }

      // Map requests to booking format
      let mappedRequests: any[] = [];
      const graceCutoff = Date.now() - 60 * 60 * 1000;

      if (requestsRes?.data && Array.isArray(requestsRes.data)) {
        mappedRequests = requestsRes.data
          .filter((r: any) => {
            const schedAt = r.scheduled_at || r.booking_id?.scheduled_at;
            if (schedAt && new Date(schedAt).getTime() < graceCutoff) return false;
            return true;
          })
          .map((r: any) => {
          const booking = r.booking_id || {};
          const serviceName = r.service_name || booking.subservice_id?.subservice_name || booking.subservice_id?.service_id?.service_name || "Service";
          const amt = r.amount !== undefined ? r.amount : (booking.payable_amount || 0);
          const schedAt = r.scheduled_at || booking.scheduled_at;
          const addr = r.location?.address || booking.address_id?.address_line || "Address";

          return {
            id: r.display_id || booking.booking_id || "NEW JOB",
            _id: r._id,
            booking_id_raw: booking._id,
            isRequest: true,
            customer: booking.user_id?.name || "Customer",
            service: serviceName,
            dateTime: schedAt ? new Date(schedAt).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }) : "N/A",
            address: addr,
            amount: `₹${amt}`,
            status: "Provider Searching",
            phone: booking.user_id?.phone || "N/A",
            avatar: booking.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.user_id?.name || 'Customer'}`
          };
        });
      }

      // Map backend data to UI format, filtering out 'provider_searching' since those are shown via JobRequests
      let mappedBookings: any[] = [];
      let totalPgs = 1;
      if (bookingsRes?.data) {
        const bookingsData = Array.isArray(bookingsRes.data)
          ? bookingsRes.data
          : (bookingsRes.data?.data || []);

        const formatAddress = (addr: any) => {
          if (!addr) return "Address not available";
          if (typeof addr === 'string') return addr;
          const line = addr.address_line || addr.street || addr.address || addr.house_no || '';
          const city = addr.city || addr.state || addr.pincode || '';
          const parts = [line, city].filter((p: string) => p && p !== 'undefined');
          return parts.length > 0 ? parts.join(', ') : (addr.full_address || "Address not available");
        };

        const GRACE_PERIOD_MS = 60 * 60 * 1000; // 60 mins grace period

        mappedBookings = bookingsData
          .map((b: any) => {
            const raw = b.status || 'accepted';
            const formattedAddr = formatAddress(b.address_id);
            const isSearchingState = ['provider_searching', 'pending'].includes(raw);
            const isAcceptedState = ['accepted', 'confirmed', 'on_the_way', 'reached', 'arrived', 'waiting_start_otp'].includes(raw);
            const isInProgressState = ['in_progress', 'waiting_end_otp'].includes(raw);

            return {
              id: b.booking_id,
              _id: b._id,
              customer: b.user_id?.name || "Customer",
              service: b.subservice_id?.service_id?.service_name || b.subservice_id?.subservice_name || "General Service",
              dateTime: b.scheduled_at ? new Date(b.scheduled_at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              }) : "N/A",
              address: formattedAddr,
              amount: `₹${b.payable_amount}`,
              rawStatus: raw,
              status: isSearchingState ? 'Provider Searching' : (isAcceptedState ? 'Accepted' : (isInProgressState ? 'In Progress' : (raw === 'completed' ? 'Completed' : 'Cancelled'))),
              phone: b.user_id?.phone || "N/A",
              email: b.user_id?.email || "",
              avatar: b.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${b.user_id?.name || 'Customer'}`,
              address_id: b.address_id,
              booking_id: b.booking_id,
              scheduled_at: b.scheduled_at,
              booking_time: b.booking_time,
              beforePhotos: b.beforePhotos || [],
              afterPhotos: b.afterPhotos || [],
              estimatedDistance: b.estimatedDistance || 4.5,
              estimatedTravelMinutes: b.estimatedTravelMinutes || 18,
              estimatedArrivalTime: b.estimatedArrivalTime ? new Date(b.estimatedArrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
              navigationUrl: (() => {
                // ponytail: Address model has latitude/longitude at top level, or location.coordinates [lng, lat]
                const addr = b.address_id;
                if (addr?.latitude && addr?.longitude) {
                  return `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}&travelmode=driving`;
                }
                const coords = addr?.location?.coordinates;
                if (coords && coords.length === 2) {
                  return `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}&travelmode=driving`;
                }
                return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formattedAddr)}`;
              })()
            };
          });
        totalPgs = bookingsRes.data?.pages || 1;
      }

      const requestIds = new Set(mappedRequests.map((r: any) => String(r.id || r._id)));
      const uniqueBookings = mappedBookings.filter((b: any) => !requestIds.has(String(b.id || b._id)));
      const combined = [...mappedRequests, ...uniqueBookings];
      setBookings(combined);
      if (typeof window !== 'undefined') {
        localStorage.setItem("provider_bookings_cache", JSON.stringify(combined));
      }
      setTotalPages(totalPgs);
      setPage(pageToFetch);
      setLastUpdated(new Date());
    } catch (error: any) {
      console.error("Critical error fetching bookings:", error);
      setError(error.message || "A critical error occurred while loading bookings.");
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, isRequest?: boolean) => {
    try {
      if (newStatus === 'Accepted') {
        await apiClient.post(`/providers/job-requests/${id}/accept`, {});
        // ponytail: auto-switch tab to Accepted so provider is focused on current job
        setActiveTab('Accepted');
        messageApi.success("Booking accepted! Viewing customer details and location.");
      } else if (newStatus === 'Cancelled' || newStatus === 'cancelled') {
        if (isRequest) {
          try {
            await apiClient.post(`/providers/job-requests/${id}/reject`, {});
          } catch {
            await apiClient.put(`/bookings/${id}/cancel`, { reason: 'Provider rejected request' });
          }
        } else {
          try {
            await apiClient.put(`/bookings/${id}/cancel`, { reason: 'Provider cancelled service' });
          } catch {
            await apiClient.put(`/bookings/${id}/status`, { status: 'cancelled' });
          }
        }
        messageApi.success("Booking request cancelled/rejected.");
      } else if (newStatus.toLowerCase() === 'reached' || newStatus.toLowerCase() === 'arrived') {
        // 100m GPS Proximity Guard with Browser Permission Check
        const targetBooking = bookings.find((b: any) => b._id === id || b.id === id);
        const addr = targetBooking?.address_id;
        const destLat = addr?.latitude || addr?.location?.coordinates?.[1];
        const destLng = addr?.longitude || addr?.location?.coordinates?.[0];
        if (typeof window !== 'undefined' && destLat && destLng) {
          if (!navigator.geolocation) {
            messageApi.error("Geolocation is not supported by your browser.");
            return;
          }
          const pos: any = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                  messageApi.error("GPS Location permission denied. Please allow location access to mark arrival.");
                } else {
                  messageApi.warning("Unable to fetch current GPS coordinates. Please ensure location services are enabled.");
                }
                resolve(null);
              },
              { timeout: 5000, enableHighAccuracy: true }
            );
          });

          if (pos?.coords) {
            const pLat = pos.coords.latitude;
            const pLng = pos.coords.longitude;
            const R = 6371;
            const dLat = (destLat - pLat) * Math.PI / 180;
            const dLon = (destLng - pLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(pLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            if (distKm > 0.1) {
              const meters = Math.round(distKm * 1000);
              messageApi.error(`❌ You are not yet at the customer's location. Current distance: ${meters > 1000 ? (distKm.toFixed(1) + 'km') : (meters + 'm')}. Please move closer to continue.`);
              return;
            }
          }
        }

        await apiClient.put(`/bookings/${id}/status`, { status: 'reached' });
        messageApi.success("Reached customer location!");
      } else {
        await apiClient.put(`/bookings/${id}/status`,
          { status: newStatus.toLowerCase().replace(' ', '_') }
        );
      }
      fetchBookings(page);
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || "Error updating booking status");
    }
  };

  const handleStartService = async (booking: any, beforePhotos: string[]) => {
    try {
      setActionLoading(booking._id);
      await apiClient.post(`/bookings/${booking._id}/start-service`, { beforePhotos });
      messageApi.success("Start OTP sent to customer");
      await fetchBookings(page); // Refresh bookings to update status
      handleOpenOtpModal({ ...booking, rawStatus: 'waiting_start_otp' }, 'start');
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || "Failed to start service");
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinishService = async (booking: any, afterPhotos: string[]) => {
    try {
      setActionLoading(booking._id);
      await apiClient.post(`/bookings/${booking._id}/finish-service`, { afterPhotos });
      messageApi.success("End OTP sent to customer");
      await fetchBookings(page); // Refresh bookings to update status
      handleOpenOtpModal({ ...booking, rawStatus: 'waiting_end_otp' }, 'end');
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || "Failed to finish service");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenOtpModal = (booking: any, type: 'start' | 'end') => {
    setOtpBooking(booking);
    setOtpType(type);
    setOtpValue('');
    setOtpError('');
    setOtpLoading(false);
    setOtpModalOpen(true);
    setResendTimer(60);
    setBeforePhotos([]);
  };

  const handleVerifyOtp = async () => {
    if (!otpValue || (otpValue.length !== 4 && otpValue.length !== 6)) {
      setOtpError("Please enter a valid OTP (4 or 6 digits)");
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError('');

      // Send beforePhotos if available
      await apiClient.post(`/bookings/${otpBooking._id}/verify-${otpType}-otp`, {
        otp: otpValue,
        beforePhotos: beforePhotos
      });
      
      messageApi.success(otpType === 'start' ? "Service started successfully!" : "Service completed successfully!");
      setOtpModalOpen(false);
      setOtpBooking(null);
      setBeforePhotos([]);
      await fetchBookings(page);
    } catch (error: any) {
      const errMsg = error.response?.data?.message || "Failed to verify OTP";
      setOtpError(errMsg);
      messageApi.error(errMsg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    try {
      setOtpLoading(true);
      await apiClient.post(`/bookings/${otpBooking._id}/resend-otp`, { type: otpType });
      messageApi.success("OTP resent successfully!");
      setResendTimer(60);
      setOtpError('');
    } catch (error: any) {
      messageApi.error(error.response?.data?.message || "Failed to resend OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesTab = b.status.toLowerCase() === activeTab.toLowerCase();
    const matchesSearch = b.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesDate = true;
    if (selectedDate) {
      const bDate = new Date(b.dateTime).toDateString();
      const sDate = new Date(selectedDate).toDateString();
      matchesDate = bDate === sDate;
    }

    return matchesTab && matchesSearch && matchesDate;
  }).sort((a, b) => {
    if (sortBy === "price_high") return parseFloat(b.amount.replace('₹', '')) - parseFloat(a.amount.replace('₹', ''));
    if (sortBy === "price_low") return parseFloat(a.amount.replace('₹', '')) - parseFloat(b.amount.replace('₹', ''));
    if (sortBy === "oldest") return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
    return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime(); // newest
  });

  return (
    <>
      {contextHolder}
      <BookingDetailModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
        onUpdateStatus={handleUpdateStatus}
        onStartService={handleStartService}
        onFinishService={handleFinishService}
        onOpenOtpModal={handleOpenOtpModal}
        actionLoading={actionLoading}
      />

      {otpModalOpen && otpBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setOtpModalOpen(false)}
          />
          {/* Modal content */}
          <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setOtpModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-[#1D2B83]/10 rounded-2xl flex items-center justify-center text-[#1D2B83] mx-auto mb-4">
                <Clock size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">
                Verify {otpType === 'start' ? 'Start' : 'End'} OTP
              </h3>
              <p className="text-slate-400 font-medium text-xs mt-1 leading-relaxed">
                Enter the verification OTP provided by the customer for booking <span className="font-bold text-[#1D2B83]">{otpBooking.id}</span>
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtpValue(val);
                    if (val.length === 4 || val.length === 6) {
                      setOtpError('');
                    }
                  }}
                  className="w-full tracking-[0.5em] text-center font-black text-2xl h-16 border-2 border-slate-100 focus:border-[#1D2B83] rounded-2xl outline-none transition-colors"
                  placeholder="----"
                />
                {otpError && (
                  <p className="text-rose-500 font-bold text-xs mt-2 text-center bg-rose-50 p-2 rounded-xl border border-rose-100 leading-relaxed">
                    {otpError}
                  </p>
                )}
              </div>

              {/* Before Service Photo Upload Section */}
              {otpType === 'start' && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-left">
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">Before Service Photo (Optional)</label>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">Attach a photo of the service work area before starting.</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const url = ev.target?.result as string;
                          setBeforePhotos([url]);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 transition-all cursor-pointer"
                  />
                  {beforePhotos.length > 0 && (
                    <div className="flex items-center gap-2 pt-1 text-emerald-600 font-bold text-xs">
                      <CheckCircle2 size={14} /> Before photo attached successfully
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || (otpValue.length !== 4 && otpValue.length !== 6)}
                  className="flex-1 py-3.5 bg-[#1D2B83] hover:bg-[#162268] text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors shadow-lg shadow-blue-900/10 disabled:opacity-50"
                >
                  {otpLoading ? "Verifying..." : "Verify OTP & Start Service"}
                </button>
              </div>

              <div className="text-center pt-2">
                {resendTimer > 0 ? (
                  <span className="text-[11px] font-bold text-slate-400">
                    Resend code in <span className="text-[#1D2B83] font-black">{Math.floor(resendTimer / 60)}:{String(resendTimer % 60).padStart(2, '0')}</span>
                  </span>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    disabled={otpLoading}
                    className="text-[11px] font-black text-[#1D2B83] hover:text-[#162268] uppercase tracking-widest transition-colors disabled:opacity-50"
                  >
                    Resend Code
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
              {lastUpdated && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-slate-500 font-medium">Track your service requests and manage job progress.</p>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm flex items-center gap-1 max-w-full overflow-hidden shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeTab === tab
                    ? "bg-[#1D2B83] text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm w-full lg:min-w-[320px]">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm text-slate-600 w-full font-medium"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => (document.getElementById('date-picker') as HTMLInputElement).showPicker()}
                className={`p-3 border rounded-2xl transition-all shadow-sm flex items-center gap-2 ${selectedDate ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
              >
                <Calendar className="h-5 w-5" />
                {selectedDate && <span className="text-xs font-bold">{new Date(selectedDate).toLocaleDateString()}</span>}
              </button>
              <input
                id="date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute opacity-0 pointer-events-none"
              />
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate("")}
                  className="absolute -top-1 -right-1 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center gap-2 px-5 py-3 border rounded-2xl font-bold text-sm transition-all shadow-sm shrink-0 ${isFilterOpen ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort By</div>
                  {[
                    { id: 'newest', label: 'Newest First' },
                    { id: 'oldest', label: 'Oldest First' },
                    { id: 'price_high', label: 'Price: High to Low' },
                    { id: 'price_low', label: 'Price: Low to High' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${sortBy === option.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-500 font-medium">Loading your bookings...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-rose-100 p-8 text-center max-w-lg mx-auto shadow-sm">
              <div className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-500">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Failed to load bookings</h3>
              <p className="text-slate-500 font-medium text-sm mb-6 leading-relaxed">{error}</p>
              <button
                onClick={() => fetchBookings(page)}
                className="px-6 py-3 bg-[#1D2B83] text-white rounded-2xl font-bold text-sm hover:bg-[#162268] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <div 
                key={booking.id} 
                onClick={() => setSelectedBooking(booking)}
                className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Customer Info */}
                    <div className="flex items-center gap-4 lg:w-64 shrink-0">
                      <img src={booking.avatar} alt="" className="h-14 w-14 rounded-2xl border-2 border-white shadow-sm shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-slate-900 truncate">{booking.customer}</h3>
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase inline-block mt-0.5">{booking.id}</span>
                      </div>
                    </div>

                    {/* Service Info */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                            <Calendar className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="text-sm font-bold text-slate-800">{booking.dateTime}</span>
                        </div>
                        <div className="flex items-start gap-3 text-slate-500">
                          <div className="p-1.5 bg-slate-50 rounded-lg shrink-0 mt-0.5">
                            <MapPin className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="text-xs font-medium text-slate-600 leading-relaxed">{booking.address}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                            <Clock className="h-4 w-4 text-slate-500" />
                          </div>
                          <span className="text-sm font-bold text-slate-800">{booking.service}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                          <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                            <Phone className="h-4 w-4 text-slate-500" />
                          </div>
                          <a 
                            href={`tel:${booking.phone}`} 
                            onClick={(e) => e.stopPropagation()} 
                            className="text-sm font-bold text-primary hover:underline"
                          >
                            {booking.phone}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 shrink-0">
                      <div className="text-right lg:text-center">
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Earnings</span>
                        <span className="text-xl font-black text-slate-900">{booking.amount}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {booking.status === "Provider Searching" ? (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(booking._id, "Accepted", booking.isRequest); }}
                              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-all shadow-md shadow-primary/20"
                            >
                              <Check className="h-4 w-4" />
                              Accept
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(booking._id, "Rejected", booking.isRequest); }}
                              className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : booking.rawStatus === "confirmed" || booking.rawStatus === "accepted" || booking.rawStatus === "ready_confirmed" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setJourneyModalBooking(booking); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                          >
                            <Navigation className="h-4 w-4" />
                            Start Journey
                          </button>
                        ) : booking.rawStatus === "on_the_way" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(booking._id, "reached"); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                          >
                            <MapPin className="h-4 w-4" />
                            I've Arrived
                          </button>
                        ) : booking.rawStatus === "reached" || booking.rawStatus === "arrived" || booking.rawStatus === "waiting_start_otp" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenOtpModal(booking, 'start'); }}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            Enter Start OTP
                          </button>
                        ) : booking.status === "In Progress" ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenOtpModal(booking, 'end'); }}
                            className="flex items-center gap-2 px-8 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-md shadow-purple-100"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Finish Service
                          </button>
                        ) : (
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            booking.status === "Completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-500"
                          }`}>
                            {booking.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Booking Accepted Card - shows "Open in Google Maps" */}
                  {(booking.rawStatus === "confirmed" || booking.rawStatus === "accepted" || booking.rawStatus === "ready_confirmed") && (
                    <div className="w-full mt-3 bg-gradient-to-br from-emerald-50 via-white to-green-50 border border-emerald-100 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-emerald-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                          <span className="text-sm font-black text-white uppercase tracking-wider">Booking Accepted</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black uppercase rounded-full tracking-wider">Accepted</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                          ✅ You have accepted this booking successfully.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                            <p className="text-sm font-black text-slate-900">{booking.customer}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
                            <a href={`tel:${booking.phone}`} onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-indigo-600 hover:underline block">{booking.phone}</a>
                          </div>
                          {booking.email && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                              <p className="text-sm font-medium text-slate-600">{booking.email}</p>
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service</span>
                            <p className="text-sm font-bold text-slate-800">{booking.service}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date & Time</span>
                            <p className="text-sm font-bold text-slate-800">{booking.dateTime}</p>
                          </div>
                          <div className="space-y-0.5 col-span-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</span>
                            <p className="text-xs font-medium text-slate-600">{booking.address}</p>
                          </div>
                        </div>
                        <a
                          href={booking.navigationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-200"
                        >
                          <Navigation className="h-4 w-4" />
                          Open in Google Maps
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Journey to Customer Card (En Route) */}
                  {booking.rawStatus === "on_the_way" && (
                    <div className="w-full mt-3 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-indigo-100 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-indigo-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Navigation className="h-4 w-4 text-white animate-pulse" />
                          <span className="text-sm font-black text-white uppercase tracking-wider">On The Way</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black uppercase rounded-full tracking-wider">En Route</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs text-indigo-700 font-medium bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                          🚗 You are on the way to the customer location
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                            <p className="text-sm font-black text-slate-900">{booking.customer}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service</span>
                            <p className="text-sm font-bold text-indigo-600">{booking.service}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Arrival</span>
                            <p className="text-sm font-bold text-emerald-600">{booking.estimatedTravelMinutes} mins ({booking.estimatedDistance} km)</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled</span>
                            <p className="text-sm font-bold text-slate-800">{booking.dateTime}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={booking.navigationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            Open in Google Maps
                          </a>
                          {booking.phone && booking.phone !== "N/A" && (
                            <a
                              href={`tel:${booking.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(booking._id, "reached"); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            I've Arrived
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Reached Location Card */}
                  {(booking.rawStatus === "reached" || booking.rawStatus === "arrived") && (
                    <div className="w-full mt-3 bg-gradient-to-br from-amber-50 via-white to-orange-50 border border-amber-100 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-amber-600 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-white" />
                          <span className="text-sm font-black text-white uppercase tracking-wider">Reached Location</span>
                        </div>
                        <span className="px-2.5 py-0.5 bg-white/20 text-white text-[10px] font-black uppercase rounded-full tracking-wider">Arrived</span>
                      </div>
                      <div className="p-4 space-y-3">
                        <p className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          📍 You have reached the customer location
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</span>
                            <p className="text-sm font-black text-slate-900">{booking.customer}</p>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</span>
                            <a href={`tel:${booking.phone}`} onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-indigo-600 hover:underline block">{booking.phone}</a>
                          </div>
                          {booking.email && (
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</span>
                              <p className="text-sm font-medium text-slate-600">{booking.email}</p>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartService(booking, []); }}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Service (Start OTP)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Timeline */}
                <div className="flex items-center w-full mt-6 pt-5 border-t border-slate-100 px-2 lg:px-4">
                  {(() => {
                    const stages = ["Accepted", "En Route", "Arrived", "In Progress", "Completed"];
                    const rawToStage: Record<string, string> = {
                      provider_searching: "",
                      confirmed: "Accepted", accepted: "Accepted", ready_confirmed: "Accepted",
                      on_the_way: "En Route",
                      reached: "Arrived", arrived: "Arrived",
                      waiting_start_otp: "Arrived",
                      in_progress: "In Progress", waiting_end_otp: "In Progress",
                      completed: "Completed"
                    };
                    const currentStage = rawToStage[booking.rawStatus] || "";
                    const currentIdx = stages.indexOf(currentStage);

                    return stages.map((stage, idx, arr) => {
                      const isDone = currentIdx >= idx;
                      const isPast = currentIdx > idx;
                      const isLast = idx === arr.length - 1;
                      return (
                        <React.Fragment key={stage}>
                          <div className="flex flex-col items-center relative">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center z-10 transition-all ${isDone ? 'bg-[#1D2B83] text-white shadow-md shadow-blue-900/20' : 'bg-slate-100 border-2 border-slate-200'}`}>
                              {isDone ? <Check size={12} strokeWidth={3} /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                            </div>
                            <span className={`absolute top-8 text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-colors ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                              {stage}
                            </span>
                          </div>
                          {!isLast && (
                            <div className={`flex-1 h-1 mx-2 rounded-full transition-all ${isPast ? 'bg-[#1D2B83]' : 'bg-slate-100'}`} />
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
                <div className="h-6" /> {/* Padding for absolute text */}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[40px] border border-dashed border-slate-200">
              <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No {activeTab} Bookings</h3>
              <p className="text-slate-400 font-medium">When you get a new booking, it will show up here.</p>
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-8 bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl disabled:opacity-50 transition-all text-sm"
            >
              Previous
            </button>
            <span className="text-sm font-bold text-[#1D2B83]">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl disabled:opacity-50 transition-all text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Journey Confirmation Modal */}
      <JourneyConfirmationModal
        isOpen={!!journeyModalBooking}
        booking={journeyModalBooking}
        onClose={() => setJourneyModalBooking(null)}
        onConfirmStart={async () => {
          if (!journeyModalBooking) return;
          const bk = journeyModalBooking;
          setJourneyModalBooking(null);
          await handleUpdateStatus(bk._id, "on_the_way");
          // Auto-open Google Maps navigation — navigationUrl already uses correct coords
          if (bk.navigationUrl) {
            window.open(bk.navigationUrl, '_blank');
          }
        }}
      />
    </>
  );
}
