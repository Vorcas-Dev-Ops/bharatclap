"use client";

import React from "react";
import AddServiceModal from "@/components/provider/modals/AddServiceModal";
import { 
  TrendingUp, 
  CheckCircle2, 
  Wallet, 
  Star, 
  ArrowUpRight, 
  MoreHorizontal,
  Plus,
  Zap,
  Clock,
  MapPin,
  User
} from "lucide-react";
import { API_URL } from "@/config/api";

const recentBookings = [
  {
    id: "BK-9821",
    customer: "Priya Singh",
    service: "Deep Home Cleaning",
    date: "Today, 10:00 AM",
    status: "Upcoming",
    amount: "₹2,499",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Priya"
  },
  {
    id: "BK-9820",
    customer: "Rahul Mehta",
    service: "AC Service",
    date: "Today, 02:30 PM",
    status: "Confirmed",
    amount: "₹899",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul"
  },
  {
    id: "BK-9819",
    customer: "Amit Verma",
    service: "Bathroom Cleaning",
    date: "Yesterday",
    status: "Completed",
    amount: "₹1,200",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Amit"
  }
];

export default function DashboardOverview() {
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [providerData, setProviderData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchProviderProfile();
  }, []);

  const fetchProviderProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/providers/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  const toggleStatus = async () => {
    if (!providerData) return;
    
    const newStatus = providerData.availability_status === 'available' ? 'offline' : 'available';
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/providers/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ availability_status: newStatus }),
      });

      if (response.ok) {
        const updated = await response.json();
        setProviderData(updated);
        // Dispatch event for TopNavbar to pick up
        window.dispatchEvent(new CustomEvent('providerStatusChanged', { detail: newStatus }));
      }
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const dynamicStats = [
    { name: "Total Jobs", value: providerData?.total_jobs?.toString() || "0", icon: TrendingUp, color: "bg-blue-500", trend: "+12%" },
    { name: "Completed", value: providerData?.completed_jobs?.toString() || "0", icon: CheckCircle2, color: "bg-emerald-500", trend: "+8%" },
    { name: "Earnings", value: "₹0", icon: Wallet, color: "bg-primary-light", trend: "+15%" },
    { name: "Rating", value: providerData?.overall_rating?.toFixed(1) || "0.0", icon: Star, color: "bg-amber-500", trend: "0.0" },
  ];

  if (loading) {
     return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
     );
  }

  return (
    <>
      <AddServiceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name?.split(' ')[0] || "Provider"}!</h1>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('openProviderProfile'))}
                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                title="Edit Profile"
              >
                <User size={14} />
              </button>
            </div>
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
              className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-all duration-500 relative ${
                providerData?.availability_status === 'available' ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <div 
                className={`w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 flex items-center justify-center ${
                  providerData?.availability_status === 'available' ? 'translate-x-6' : 'translate-x-0'
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
          {dynamicStats.map((stat) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Bookings */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Recent Bookings</h2>
              <button className="text-sm font-bold text-primary hover:text-primary-dark">View All</button>
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
                  {recentBookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={booking.avatar} alt="" className="h-10 w-10 rounded-full border-2 border-white shadow-sm" />
                          <div>
                            <span className="block text-sm font-bold text-slate-900">{booking.customer}</span>
                            <span className="block text-[11px] font-medium text-slate-400 uppercase">{booking.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600">{booking.service}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-700">{booking.date}</span>
                          <span className="text-xs font-medium text-slate-400">Home Service</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                          booking.status === "Completed" ? "bg-emerald-50 text-emerald-600" :
                          booking.status === "Upcoming" ? "bg-blue-50 text-blue-600" :
                          "bg-amber-50 text-amber-600"
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
                  ))}
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
              <p className="text-3xl font-bold mb-6">₹0.0</p>
              <button className="w-full py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-primary/5 transition-all shadow-lg">
                Withdraw Money
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Daily Schedule</h3>
              <div className="space-y-4">
                {[
                  { time: "09:00 AM", task: "Prep Equipment", type: "system" },
                  { time: "10:00 AM", task: "Deep Cleaning - Priya", type: "job" },
                  { time: "01:00 PM", task: "Lunch Break", type: "break" },
                  { time: "02:30 PM", task: "AC Service - Rahul", type: "job" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="text-xs font-bold text-slate-400 w-16 pt-1">{item.time}</span>
                    <div className={`flex-1 p-3 rounded-2xl text-sm font-bold ${
                      item.type === "job" ? "bg-primary/10 text-primary border border-primary/20" :
                      item.type === "break" ? "bg-slate-50 text-slate-600 border border-slate-100" :
                      "bg-amber-50 text-amber-700 border border-amber-100"
                    }`}>
                      {item.task}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
