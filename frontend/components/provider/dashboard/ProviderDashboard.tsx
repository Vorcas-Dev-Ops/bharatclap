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
import { API_URL, apiClient } from "@/config/api";
import { connectSocket, disconnectSocket } from "@/services/socket";
import Link from "next/link";


export default function ProviderDashboard() {
  const [user, setUser] = React.useState<any>(null);
  const [providerData, setProviderData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [jobRequests, setJobRequests] = React.useState<any[]>([]);
  const [bookings, setBookings] = React.useState<any[]>([]);
  const [banners, setBanners] = React.useState<any[]>([]);
  const [bannersLoading, setBannersLoading] = React.useState(true);
  const [bannersError, setBannersError] = React.useState<string | null>(null);
  const [wallet, setWallet] = React.useState<any>(null);
  const [leadPackages, setLeadPackages] = React.useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = React.useState(false);
  const [purchasingPkgId, setPurchasingPkgId] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [liveGpsArea, setLiveGpsArea] = React.useState<string>("Live Location");
  const [liveDistanceKm, setLiveDistanceKm] = React.useState<number>(0.0);
  const [lastUpdatedSec, setLastUpdatedSec] = React.useState<number>(0);

  React.useEffect(() => {
    const handleLocationUpdate = (e: any) => {
      if (e.detail?.area) setLiveGpsArea(e.detail.area);
      if (typeof e.detail?.distanceKm === 'number') setLiveDistanceKm(e.detail.distanceKm);
      setLastUpdatedSec(0);
    };

    window.addEventListener('providerLocationUpdated', handleLocationUpdate);

    const timer = setInterval(() => {
      setLastUpdatedSec(prev => prev + 1);
    }, 1000);

    return () => {
      window.removeEventListener('providerLocationUpdated', handleLocationUpdate);
      clearInterval(timer);
    };
  }, []);

  const stats = [
    { name: "Total Jobs", value: providerData?.total_jobs?.toString() || "0", icon: TrendingUp, color: "bg-blue-500", trend: providerData?.total_jobs_trend },
    { name: "Completed", value: providerData?.completed_jobs?.toString() || "0", icon: CheckCircle2, color: "bg-emerald-500", trend: providerData?.completed_jobs_trend },
    { name: "Earnings", value: "₹" + (providerData?.earnings || 0), icon: Wallet, color: "bg-primary-light", trend: providerData?.earnings_trend },
    { name: "Rating", value: providerData?.overall_rating?.toFixed(1) || "0.0", icon: Star, color: "bg-amber-500", trend: providerData?.rating_trend },
  ];

  const fetchWalletBalance = async () => {
    try {
      const response = await apiClient.get('/providers/wallet/balance');
      if (response.status === 200) {
        setWallet(response.data);
      }
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
    }
  };

  const fetchLeadPackages = async () => {
    try {
      setPackagesLoading(true);
      const response = await apiClient.get('/providers/lead-packages');
      if (response.status === 200) {
        setLeadPackages(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error("Error fetching lead packages:", error);
    } finally {
      setPackagesLoading(false);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePurchasePackage = async (pkg: any) => {
    try {
      setPurchasingPkgId(pkg._id);
      const sdkLoaded = await loadRazorpay();

      const response = await apiClient.post('/providers/lead-packages/purchase', { packageId: pkg._id });

      if (response.data.freeAccess) {
        alert(response.data.message || `Activated package "${pkg.name}" successfully with Free Access!`);
        fetchWalletBalance();
        fetchProviderProfile();
        return;
      }

      if (!sdkLoaded) {
        alert("Failed to load Razorpay SDK. Please check your network connection.");
        return;
      }

      const { razorpayOrder, rzpOrder, key_id } = response.data;
      const orderToUse = razorpayOrder || rzpOrder;

      const options = {
        key: key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_51Z1Z1Z1Z1Z1Z1",
        amount: orderToUse.amount,
        currency: orderToUse.currency || "INR",
        name: "BharatClap Lead Package",
        description: `Purchase Package: ${pkg.name} (₹${pkg.price})`,
        order_id: orderToUse.id,
        handler: async (paymentRes: any) => {
          try {
            const verifyResponse = await apiClient.post('/providers/lead-packages/verify', {
              razorpay_order_id: paymentRes.razorpay_order_id,
              razorpay_payment_id: paymentRes.razorpay_payment_id,
              razorpay_signature: paymentRes.razorpay_signature,
            });

            if (verifyResponse.data.success) {
              alert(`Package "${pkg.name}" activated successfully!`);
              fetchWalletBalance();
              fetchProviderProfile();
            } else {
              alert("Payment verification failed.");
            }
          } catch (e) {
            console.error("Verification failed", e);
            alert("Verification failed.");
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || ""
        },
        theme: { color: "#1D2B83" }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();
    } catch (error: any) {
      console.error("Package purchase failed", error);
      alert(error.response?.data?.message || "Package purchase failed");
    } finally {
      setPurchasingPkgId(null);
    }
  };

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
    fetchBanners();
    fetchWalletBalance();
    fetchLeadPackages();

    const handleFocus = () => {
      fetchWalletBalance();
      fetchProviderProfile();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  React.useEffect(() => {
    if (user && user._id) {
      const socket = connectSocket(user._id, 'provider');

      const handleBookingAssigned = (request: any) => {
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
      };

      socket.on('booking_assigned', handleBookingAssigned);

      // Request notification permission
      if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
      }

      // Sync Location
      const syncLocation = () => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;

            socket.emit('location_update', {
              providerId: providerData?._id,
              lat: latitude,
              lng: longitude
            });

            // Also update via API for persistence only when available and kit purchased
            const token = localStorage.getItem("token");
            if (token && providerData?.availability_status === 'available' && providerData?.kitPurchased !== false) {
              apiClient.patch(`/providers/live-location`, {
                latitude,
                longitude
              }).catch(e => {
                if (e.response?.status !== 403) {
                  console.error("Location sync failed", e);
                }
              });
            }
          });
        }
      };

      syncLocation();
      const locInterval = setInterval(syncLocation, 60000); // 1 min for live tracking

      // Poll for new job requests every 30s as a socket fallback
      const pollInterval = setInterval(fetchJobRequests, 30000);

      return () => {
        socket.off('booking_assigned', handleBookingAssigned);
        clearInterval(locInterval);
        clearInterval(pollInterval);
        // disconnectSocket(); // Keep connected while on dashboard
      };
    }
  }, [user, providerData?._id, providerData?.availability_status, providerData?.kitPurchased]);

  const fetchProviderProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await apiClient.get(`/providers/me`);
      if (response.status === 200) {
        setProviderData(response.data);
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
      if (!token) return;
      const response = await apiClient.get(`/providers/job-requests`);
      setJobRequests(response.data);
    } catch (e: any) {
      if (e.response?.status !== 403) {
        console.error("Failed to fetch job requests", e);
      }
    }
  };

  const fetchRecentBookings = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await apiClient.get(`/bookings/my`);
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

  const fetchBanners = async () => {
    try {
      setBannersLoading(true);
      setBannersError(null);
      const response = await apiClient.get('/banners', {
        params: { role: 'provider' },
        validateStatus: status => status < 500
      });
      if (response.status === 200 && Array.isArray(response.data)) {
        setBanners(response.data);
      } else {
        setBanners([]);
      }
    } catch (error: any) {
      console.warn("Banners endpoint unavailable:", error?.message);
      setBanners([]);
    } finally {
      setBannersLoading(false);
    }
  };

  const handleAcceptJob = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await apiClient.post(`/providers/job-requests/${requestId}/accept`, {});
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
      if (!token) return;
      await apiClient.post(`/providers/job-requests/${requestId}/reject`, {});
      setJobRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (e) {
      console.error("Failed to reject job", e);
    }
  };

  const toggleStatus = async () => {
    if (!providerData) return;

    if (!providerData.kitPurchased) {
      alert("Please complete your Starter Kit purchase before going online.");
      return;
    }
    if (wallet?.status === 'blocked' || providerData.isWalletBlocked) {
      alert("Orders Blocked: Balance is below minimum limit ₹50. Please recharge your wallet before going online.");
      return;
    }

    const newStatus = providerData.availability_status === 'available' ? 'offline' : 'available';
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await apiClient.put(`/providers/availability`,
        { status: newStatus }
      );

      if (response.status === 200) {
        setProviderData({
          ...providerData,
          availability_status: newStatus,
          isOnline: newStatus !== 'offline'
        });
        window.dispatchEvent(new CustomEvent('providerStatusChanged', { detail: newStatus }));
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        alert(error.response.data?.message || "Orders locked: Please check your Starter Kit purchase and wallet balance.");
      } else {
        console.error("Error toggling status:", error);
      }
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
              {stat.trend && (
                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                  <ArrowUpRight className="h-3 w-3" />
                  {stat.trend}
                </span>
              )}
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.name}</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Operating Location & Live GPS Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: 📌 Registered Operating Location */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-base">📌</span>
                Registered Location
              </div>
              {(providerData?.service_locations?.[0]?.name || providerData?.primary_location || providerData?.registered_location?.name) ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold uppercase">
                  ✓ Admin Approved
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-extrabold uppercase">
                  ⚠️ Pending Assignment
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{providerData?.city || providerData?.user_id?.city || "Not Specified"}</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
                📍 {providerData?.service_locations?.[0]?.name || providerData?.primary_location || providerData?.registered_location?.name || "Not Assigned"}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Fixed location assigned by Admin. Used to confirm job eligibility.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-semibold">Need to permanently relocate?</span>
            <Link
              href="/provider/area"
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all shadow-sm"
            >
              Operating Location
            </Link>
          </div>
        </div>

        {/* Card 2: 📍 Current Live GPS Location */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-all">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-black text-xs uppercase tracking-wider">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-base">📍</span>
                Current Live Location
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-extrabold uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 🟢 Online
              </span>
            </div>

            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-Time GPS Ping</p>
              <h3 className="text-xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
                {liveGpsArea}
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Distance from Registered Area: <strong className="text-slate-900 font-black">{liveDistanceKm} km</strong>
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Clock size={13} className="text-slate-400" /> Updated {lastUpdatedSec === 0 ? "Just now" : `${lastUpdatedSec} seconds ago`}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
              GPS Tracking Active
            </span>
          </div>
        </div>
      </div>

      {/* Promo Banners Carousel */}
      <div className="w-full">
        {bannersLoading ? (
          <div className="flex items-center justify-center h-40 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="w-8 h-8 border-4 border-[#1D2B83] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3 text-slate-500 font-medium text-sm">Loading promotions...</span>
          </div>
        ) : bannersError ? (
          <div className="flex flex-col items-center justify-center h-40 bg-white rounded-3xl border border-rose-100 p-4 text-center">
            <p className="text-rose-500 font-bold text-xs mb-2">Error loading promotions</p>
            <p className="text-slate-400 text-[10px] font-medium mb-3">{bannersError}</p>
            <button 
              onClick={fetchBanners}
              className="px-4 py-1.5 bg-[#1D2B83] text-white text-[10px] font-bold uppercase rounded-lg hover:bg-[#162268] transition-colors"
            >
              Retry
            </button>
          </div>
        ) : banners.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-slate-700 font-bold text-sm">No Promotions or Updates</p>
            <p className="text-slate-400 font-medium text-xs mt-1">Check back later for exclusive partner rewards and updates.</p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-4 px-4 md:mx-0 md:px-0">
            {banners.map((banner, index) => {
              const gradients = [
                "from-violet-600 to-indigo-600",
                "from-[#FF6B35] to-[#FF4B4B]",
                "from-teal-600 to-emerald-600",
                "from-blue-600 to-cyan-600",
                "from-pink-600 to-rose-600"
              ];
              const gradient = gradients[index % gradients.length];
              return (
                <div 
                  key={banner._id || index}
                  className={`flex-shrink-0 w-[85vw] sm:w-[350px] md:w-[380px] snap-start rounded-3xl bg-gradient-to-r ${gradient} p-6 text-white shadow-md hover:shadow-lg transition-all flex flex-col justify-between h-40 relative overflow-hidden group`}
                >
                  {banner.image_url && (
                    <div className="absolute inset-0 z-0 opacity-15 group-hover:scale-105 transition-transform duration-500">
                      <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="relative z-10 text-left">
                    <span className="text-xs font-semibold text-white/80 uppercase tracking-widest">Notice</span>
                    <h3 className="text-xl font-black mt-1 line-clamp-1">{banner.title}</h3>
                  </div>
                  <div className="relative z-10 flex items-end justify-between gap-4">
                    <p className="text-xs font-medium text-white/90 line-clamp-2 max-w-[70%] text-left">
                      {banner.subtitle || "Exclusive provider update."}
                    </p>
                    {banner.button_text && (
                      <Link
                        href={banner.redirect_url || "/provider/dashboard"}
                        className="px-3 py-1.5 bg-white text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-xl shadow-sm shrink-0 hover:bg-slate-50 transition-colors"
                      >
                        {banner.button_text}
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            <p className="text-3xl font-bold">₹{wallet?.walletBalance ?? providerData?.walletBalance ?? 0}</p>
          </div>

          {/* Provider Wallet Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-800 text-base font-bold">Provider Wallet</h3>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                wallet?.isFreeAccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                wallet?.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                wallet?.status === 'low_balance' ? 'bg-amber-50 text-amber-600 border border-amber-100 animate-pulse' :
                'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                {wallet?.isFreeAccess ? 'Free Access' : wallet?.status === 'active' ? 'Active' : wallet?.status === 'low_balance' ? 'Low Balance' : 'Blocked'}
              </span>
            </div>

            <div className="mb-4">
              <span className="block text-slate-400 text-xs font-semibold">Wallet Balance</span>
              <span className="text-3xl font-black text-slate-900">₹{wallet?.walletBalance ?? 0}</span>
              {wallet?.reservedBalance > 0 && (
                <span className="block text-slate-400 text-[10px] font-bold mt-0.5">
                  (₹{wallet.reservedBalance} reserved for pending jobs)
                </span>
              )}
            </div>

            {wallet?.isFreeAccess ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold mb-4 leading-normal">
                ✨ Free Access Active: You can receive unlimited job requests regardless of wallet balance.
              </div>
            ) : wallet?.status === 'low_balance' ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl text-xs font-semibold mb-4 leading-normal">
                ⚠️ Low Balance warning: Keep balance above ₹200 to avoid blockages.
              </div>
            ) : wallet?.status === 'blocked' ? (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-semibold mb-4 leading-normal">
                🚫 Orders Blocked: Balance is below minimum limit ₹50. Purchase a plan below to receive bookings.
              </div>
            ) : null}

            {/* Configured Lead Packages / Plans */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3">Available Plans & Packages</h4>
              {packagesLoading ? (
                <div className="text-center py-4 text-xs text-slate-400 font-medium">Loading packages...</div>
              ) : leadPackages.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400 font-medium">No package plans available at present.</div>
              ) : (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {leadPackages.map((pkg) => (
                    <div key={pkg._id} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <div>
                          <span className="font-bold text-xs text-slate-900">{pkg.name}</span>
                          {pkg.badgeText && (
                            <span className="ml-2 text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                              {pkg.badgeText}
                            </span>
                          )}
                        </div>
                        <span className="font-black text-sm text-slate-900">₹{pkg.price}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 mb-2.5">
                        <span>{pkg.leads + (pkg.bonusLeads || 0)} Leads</span>
                        <span>{pkg.validityDays} Days</span>
                      </div>
                      <button
                        onClick={() => handlePurchasePackage(pkg)}
                        disabled={purchasingPkgId === pkg._id}
                        className="w-full py-2 bg-[#1D2B83] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-opacity-95 transition-all disabled:opacity-50"
                      >
                        {purchasingPkgId === pkg._id ? 'Activating...' : `Buy Plan - ₹${pkg.price}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

