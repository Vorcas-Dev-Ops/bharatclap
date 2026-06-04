"use client";

import React, { useState, useEffect } from "react";
import BookingDetailModal from "@/components/provider/modals/BookingDetailModal";
import axios from "axios";
import { API_URL } from "@/config/api";
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
  MoreVertical
} from "lucide-react";

const tabs = ["Pending", "Accepted", "In Progress", "Completed"];

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
  const [activeTab, setActiveTab] = useState("Pending");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      
      const [bookingsRes, requestsRes] = await Promise.all([
        axios.get(`${API_URL}/bookings/my`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/providers/job-requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      // Map requests to booking format
      const mappedRequests = requestsRes.data.map((r: any) => {
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
          status: "Pending",
          phone: booking.user_id?.phone || "N/A",
          avatar: booking.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.user_id?.name || 'Customer'}`
        };
      });

      // Map backend data to UI format
      const mappedBookings = bookingsRes.data.map((b: any) => ({
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
        address: b.address_id ? `${b.address_id.address_line}, ${b.address_id.city}` : "Address not available",
        amount: `₹${b.payable_amount}`,
        status: b.status.charAt(0).toUpperCase() + b.status.slice(1).replace('_', ' '),
        phone: b.user_id?.phone || "N/A",
        avatar: b.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${b.user_id?.name || 'Customer'}`
      }));
      
      setBookings([...mappedRequests, ...mappedBookings]);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string, isRequest?: boolean) => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      
      if (isRequest) {
        if (newStatus === "Accepted") {
          await axios.post(`${API_URL}/providers/job-requests/${id}/accept`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } else if (newStatus === "Rejected") {
          await axios.post(`${API_URL}/providers/job-requests/${id}/reject`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else {
        await axios.put(`${API_URL}/bookings/${id}/status`, 
          { status: newStatus.toLowerCase().replace(' ', '_') },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      fetchBookings(); // Refresh list
    } catch (error: any) {
      alert(error.response?.data?.message || "Error updating booking status");
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesTab = b.status === activeTab;
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
      <BookingDetailModal 
        isOpen={!!selectedBooking} 
        onClose={() => setSelectedBooking(null)} 
        booking={selectedBooking} 
        onUpdateStatus={handleUpdateStatus}
      />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
            <p className="text-slate-500 font-medium">Track your service requests and manage job progress.</p>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm inline-flex flex-wrap gap-1">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                  activeTab === tab 
                    ? "bg-primary text-white shadow-lg shadow-primary/20" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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
                className={`p-3 border rounded-2xl transition-all shadow-sm flex items-center gap-2 ${
                  selectedDate ? "bg-primary/10 border-primary text-primary" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
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
                className={`flex items-center gap-2 px-5 py-3 border rounded-2xl font-bold text-sm transition-all shadow-sm shrink-0 ${
                  isFilterOpen ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
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
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                        sortBy === option.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-50"
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
          ) : filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <div key={booking.id} className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                  {/* Customer Info */}
                  <div className="flex items-center gap-4 lg:w-72">
                    <img src={booking.avatar} alt="" className="h-14 w-14 rounded-2xl border-2 border-white shadow-sm" />
                    <div>
                      <h3 className="text-base font-black text-slate-900">{booking.customer}</h3>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase">{booking.id}</span>
                    </div>
                  </div>

                  {/* Service Info */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-1.5 bg-slate-50 rounded-lg">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-bold">{booking.dateTime}</span>
                      </div>
                      <div className="flex items-start gap-3 text-slate-500">
                        <div className="p-1.5 bg-slate-50 rounded-lg shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium leading-relaxed">{booking.address}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-1.5 bg-slate-50 rounded-lg">
                          <Clock className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-bold">{booking.service}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600">
                        <div className="p-1.5 bg-slate-50 rounded-lg">
                          <Phone className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-bold">{booking.phone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-4 pt-6 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-8">
                    <div className="text-right lg:text-center mb-0 lg:mb-4">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Earnings</span>
                      <span className="text-xl font-black text-slate-900">{booking.amount}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {booking.status === "Pending" ? (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(booking._id, "Accepted", booking.isRequest)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
                          >
                            <Check className="h-4 w-4" />
                            Accept
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(booking._id, "Rejected", booking.isRequest)}
                            className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : booking.status === "Accepted" ? (
                        <button 
                          onClick={() => handleUpdateStatus(booking._id, "In Progress")}
                          className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        >
                          Start Job
                        </button>
                      ) : booking.status === "In Progress" ? (
                        <button 
                          onClick={() => handleUpdateStatus(booking._id, "Completed")}
                          className="flex items-center gap-2 px-8 py-2.5 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
                        >
                          Complete Job
                        </button>
                      ) : (
                        <button 
                          onClick={() => setSelectedBooking(booking)}
                          className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
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
      </div>
    </>
  );
}
