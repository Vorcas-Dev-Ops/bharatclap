"use client";

import React from "react";
import {
  TrendingUp,
  CheckCircle2,
  Wallet,
  Star,
  ArrowUpRight,
  MoreHorizontal,
  Zap,
  Clock,
  MapPin,
  Navigation,
  AlertCircle
} from "lucide-react";
import { API_URL } from "@/config/api";
import { connectSocket, disconnectSocket } from "@/services/socket";
import axios from "axios";
import Link from "next/link";


export default function ProviderDashboard() {
  const [user, setUser] = React.useState<any>(null);
  const [providerData, setProviderData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [jobRequests, setJobRequests] = React.useState<any[]>([]);
  const [bookings, setBookings] = React.useState<any[]>([]);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const stats = [
    { name: "Total Jobs", value: providerData?.total_jobs?.toString() || "0", icon: TrendingUp, color: "bg-blue-500", trend: "+12%" },
    { name: "Completed", value: providerData?.completed_jobs?.toString() || "0", icon: CheckCircle2, color: "bg-emerald-500", trend: "+8%" },
    { name: "Earnings", value: "₹" + (providerData?.earnings || 0), icon: Wallet, color: "bg-primary-light", trend: "+15%" },
    { name: "Rating", value: providerData?.overall_rating?.toFixed(1) || "0.0", icon: Star, color: "bg-amber-500", trend: "0.0" },
  ];

  React.useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        setUser(parsed);
      } catch (e) { }
    }
    fetchProviderProfile();
    fetchJobRequests();
    fetchRecentBookings();
  }, []);

  React.useEffect(() => {
    if (user && user._id) {
      const socket = connectSocket(user._id, 'provider');

      socket.on('booking_assigned', (request) => {
        console.log("New job assigned:", request);
        setJobRequests(prev => {
          if (prev.some(r => String(r._id) === String(request.request_id))) return prev;
          return [request, ...prev];
        });
        fetchJobRequests();
        fetchRecentBookings();
        fetchProviderProfile();

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New Job Request!", {
            body: `${request.service_name} at ${request.location?.city || ''}`,
            icon: '/favicon.ico'
          });
        }
      });

      // Request notification permission
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }

      // Sync Location
      const syncLocation = () => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;

            socket.emit('updateLocation', {
              providerId: providerData?._id,
              lat: latitude,
              lng: longitude
            });

            // Also update via API for persistence
            const token = localStorage.getItem("token");
            if (token) {
              axios.patch(`${API_URL}/providers/live-location`, {
                latitude,
                longitude
              }, {
                headers: { Authorization: `Bearer ${token}` }
              }).catch(e => console.error("Location sync failed", e));
            }
          });
        }
      };

      syncLocation();
      const locInterval = setInterval(syncLocation, 60000); // 1 min for live tracking

      // Poll for new job requests every 30s as a socket fallback
      const pollInterval = setInterval(fetchJobRequests, 30000);

      return () => {
        socket.off('booking_assigned');
        clearInterval(locInterval);
        clearInterval(pollInterval);
        // disconnectSocket(); // Keep connected while on dashboard
      };
    }
  }, [user, providerData?._id]);

  const fetchProviderProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/providers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setProviderData(data);
      }
    } catch (error) {
      console.error("Error fetching provider profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/providers/job-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobRequests(response.data);
    } catch (e) {
      console.error("Failed to fetch job requests", e);
    }
  };

  const fetchRecentBookings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/bookings/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const bookingsData = Array.isArray(response.data)
        ? response.data
        : (response.data?.data || []);
      const activeBookings = bookingsData.filter((b: any) =>
        ['pending', 'accepted', 'in_progress', 'on_the_way', 'arrived', 'waiting_start_otp', 'waiting_end_otp'].includes(b.status)
      );
      setBookings(activeBookings.slice(0, 5));
    } catch (e) {
      console.error("Failed to fetch bookings", e);
    }
  };

  const handleAcceptJob = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/providers/job-requests/${requestId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobRequests(prev => prev.filter(r => r._id !== requestId));
      fetchRecentBookings();
      fetchProviderProfile();
      // Show success message
    } catch (error: any) {
      alert(error.response?.data?.message || "Failed to accept job");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectJob = async (requestId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/providers/job-requests/${requestId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (e) {
      console.error("Failed to reject job", e);
    }
  };

  const toggleStatus = async () => {
    if (!providerData) return;

    const newStatus = providerData.availability_status === 'available' ? 'offline' : 'available';
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(`${API_URL}/providers/availability`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 200) {
        setProviderData({
          ...providerData,
          availability_status: newStatus,
          isOnline: newStatus !== 'offline'
        });
        window.dispatchEvent(new CustomEvent('providerStatusChanged', { detail: newStatus }));
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1D2B83]"></div>
      </div>
    );
  }

  // KYC Status Overlay
  if (providerData && providerData.kyc_status !== 'verified') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-lg w-full relative overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-2 ${providerData.kyc_status === 'pending' ? 'bg-amber-400' : 'bg-rose-500'}`} />

          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-lg ${providerData.kyc_status === 'pending' ? 'bg-amber-100 text-amber-500 shadow-amber-500/20' : 'bg-rose-100 text-rose-500 shadow-rose-500/20'
            }`}>
            {providerData.kyc_status === 'pending' ? <Clock className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
          </div>

          <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">
            {providerData.kyc_status === 'pending' ? 'Verification Pending' : 'Verification Rejected'}
          </h2>

          <p className="text-slate-500 font-medium mb-8 leading-relaxed">
            {providerData.kyc_status === 'pending'
              ? 'Your verification is under process. Please wait while our team reviews your details.'
              : 'Your KYC verification was rejected. Please re-submit documents.'}
          </p>

          {providerData.kyc_status === 'rejected' && (
            <Link href="/provider/profile">
              <button className="w-full h-14 bg-[#1D2B83] text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 hover:bg-[#162268] transition-all">
                Re-Submit KYC
              </button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name?.split(' ')[0] || "Provider"}!</h1>
          <p className="text-slate-500 font-medium">Here's what's happening with your services today.</p>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex flex-col items-end px-3 border-r border-slate-100">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Work Status</span>
            <span className={`text-[10px] font-black uppercase tracking-widest ${providerData?.availability_status === 'available' ? 'text-emerald-500' : 'text-rose-500'}`}>
              {providerData?.availability_status === 'available' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div
            onClick={toggleStatus}
            className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all duration-500 relative ${providerData?.availability_status === 'available' ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 flex items-center justify-center ${providerData?.availability_status === 'available' ? 'translate-x-6' : 'translate-x-0'
                }`}
            >
              {providerData?.availability_status === 'available' ? (
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              ) : (
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.color} text-white shadow-lg`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                <ArrowUpRight className="h-3 w-3" />
                {stat.trend}
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.name}</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Real-time Job Requests */}
      {jobRequests.length > 0 && (
        <div className="bg-amber-50/50 border-2 border-amber-200 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-6 border-b border-amber-200 flex items-center justify-between bg-amber-100/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 text-white rounded-xl animate-pulse">
                <Zap size={18} />
              </div>
              <h2 className="text-lg font-black text-amber-900 uppercase tracking-tight">Incoming Job Requests ({jobRequests.length})</h2>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-200/50 px-3 py-1 rounded-full uppercase tracking-widest">Real-time</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobRequests.map((req) => (
              <div key={req._id || req.request_id} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{req.location?.distance || "Nearby"}</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Zap size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">{req.service_name}</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{req.display_id || req.booking_id?.booking_id || "NEW JOB"}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-5">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate">{req.location?.address || req.booking_id?.address_id?.city}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                    <Clock size={14} className="text-slate-400" />
                    <span>{req.booking_time} • {new Date(req.scheduled_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[14px] font-black text-emerald-600">
                    <Wallet size={14} />
                    <span>Earn ₹{req.amount}</span>
                  </div>
                  {(req.location?.latitude && req.location?.longitude) && (
                    <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-wider bg-blue-50 p-2 rounded-lg mt-2">
                      <Navigation size={12} />
                      <span>Lat: {Number(req.location.latitude).toFixed(4)}, Lng: {Number(req.location.longitude).toFixed(4)}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptJob(req._id || req.request_id)}
                    disabled={actionLoading === (req._id || req.request_id)}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {actionLoading === (req._id || req.request_id) ? "Accepting..." : "Accept"}
                  </button>
                  <button
                    onClick={() => handleRejectJob(req._id || req.request_id)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Bookings */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Bookings</h2>
            <Link href="/provider/bookings" className="text-sm font-bold text-primary hover:text-primary-dark">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date & Time</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bookings.length > 0 ? bookings.map((booking) => (
                  <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={booking.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.user_id?.name || 'Customer'}`}
                          alt=""
                          className="h-10 w-10 rounded-full border-2 border-white shadow-sm"
                        />
                        <div>
                          <span className="block text-sm font-bold text-slate-900">{booking.user_id?.name || "Customer"}</span>
                          <span className="block text-[11px] font-medium text-slate-400 uppercase">{booking.booking_id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{booking.subservice_id?.subservice_name || "Service"}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{booking.booking_time}</span>
                        <span className="text-xs font-medium text-slate-400">{new Date(booking.scheduled_at).toLocaleDateString()}</span>
                        {(booking.address_id?.coordinates?.coordinates && booking.address_id.coordinates.coordinates.length >= 2) && (
                          <span className="text-[10px] font-bold text-blue-500 mt-1 flex items-center gap-1">
                            <Navigation size={10} />
                            {Number(booking.address_id.coordinates.coordinates[1]).toFixed(4)}, {Number(booking.address_id.coordinates.coordinates[0]).toFixed(4)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${booking.status === "completed" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          booking.status === "accepted" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            booking.status === "provider_searching" ? "bg-violet-50 text-violet-600 border border-violet-100" :
                              booking.status === "in_progress" ? "bg-cyan-50 text-cyan-600 border border-cyan-100" :
                                "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">No recent bookings found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Stats/Summary Side Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-primary rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Wallet className="h-24 w-24" />
            </div>
            <h3 className="text-primary/70 text-sm font-medium mb-1">Available Balance</h3>
            <p className="text-3xl font-bold mb-6">₹{providerData?.earnings || 0}</p>
            <button className="w-full py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-primary/5 transition-all shadow-lg">
              Withdraw Money
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Daily Schedule</h3>
            <div className="space-y-4">
              {bookings.filter(b => ['accepted', 'waiting_start_otp'].includes(b.status)).length > 0 ? (
                bookings.filter(b => ['accepted', 'waiting_start_otp'].includes(b.status)).map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="text-xs font-bold text-slate-400 w-16 pt-1">{item.booking_time}</span>
                    <div className="flex-1 p-3 rounded-2xl text-sm font-bold bg-primary/10 text-primary border border-primary/20">
                      {item.subservice_id?.subservice_name} - {item.user_id?.name}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 font-medium italic">No active jobs scheduled for today.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

