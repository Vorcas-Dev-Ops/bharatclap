"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from './StatCard';
import BookingChart from './BookingChart';
import RevenueChart from './RevenueChart';
import ServicePieChart from './ServicePieChart';
import OrderDonutChart from './OrderDonutChart';
import ProviderPerformanceChart from './ProviderPerformanceChart';
import PeakTimeHeatmap from './PeakTimeHeatmap';
import ReviewsSnapshot from './ReviewsSnapshot';
import {
   Users,
   Briefcase,
   CalendarCheck,
   DollarSign,
   XCircle,
   ShieldCheck,
   RefreshCw,
   ChevronDown,
   Calendar,
   MapPin,
   TrendingUp,
   LayoutGrid,
   ShieldAlert
} from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

export default function DashboardOverview() {
   const [revenueTimeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
   
   // State for filter dropdowns
   const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
   const [selectedDate, setSelectedDate] = useState('Last 7 Days');
   const [selectedCategory, setSelectedCategory] = useState('All Categories');
   const [selectedLocation, setSelectedLocation] = useState('All Locations');
   const [startDate, setStartDate] = useState('');
   const [endDate, setEndDate] = useState('');

   const toggleDropdown = (name: string) => {
      setActiveDropdown(activeDropdown === name ? null : name);
   };

   const handleSelect = (setter: (val: string) => void, value: string) => {
      setter(value);
      setActiveDropdown(null);
   };

   const handleApplyCustomDate = () => {
      if (startDate && endDate) {
         setSelectedDate(`${startDate} - ${endDate}`);
         setActiveDropdown(null);
      }
   };

   const handleQuickSelect = (days: number, label: string) => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);
      
      const formatDate = (d: Date) => d.toISOString().split('T')[0];
      
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
      setSelectedDate(label);
      setActiveDropdown(null);
   };

    const dateOptions = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'];
    const categoryOptions = ['All Categories', 'Cleaning', 'Repair', 'Installation', 'Moving', 'Plumbing', 'Electrical'];
    const [locationOptions, setLocationOptions] = useState<string[]>(['All Locations']);
    const [subStats, setSubStats] = useState<any>(null);

    React.useEffect(() => {
       const fetchAreas = async () => {
          try {
             const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api'}/locations?type=area`);
             if (res.ok) {
                const data = await res.json();
                const areaNames = data.map((loc: any) => loc.name);
                const uniqueAreas = Array.from(new Set(areaNames)).filter(Boolean) as string[];
                setLocationOptions(['All Locations', ...uniqueAreas]);
             }
          } catch (err) {
             console.error('Failed to fetch dynamic areas for filter:', err);
          }
       };
       const fetchSubStats = async () => {
          try {
             const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api'}/providers/admin/subscription-stats`);
             if (res.ok) {
                const data = await res.json();
                setSubStats(data);
             }
          } catch (err) {
             console.error('Failed to fetch subscription stats:', err);
          }
       };
       fetchAreas();
       fetchSubStats();
    }, []);

   // ... (stats definition remains same or adjusted for glass)
   const defaultStats = [
      { title: 'Total Users', value: '0', icon: Users, trend: 12.5, trendLabel: 'vs last month' },
      { title: 'Service Providers', value: '0', icon: Briefcase, trend: 4.2, trendLabel: 'vs last month' },
      { title: 'Total Bookings', value: '0', icon: CalendarCheck, trend: 18.2, trendLabel: 'vs last month' },
      { title: 'Revenue', value: '₹0', icon: DollarSign, trend: 14.8, trendLabel: 'vs last month' },
      { title: 'Pending Approvals', value: '0', icon: ShieldCheck, trend: 8.4, trendLabel: 'waiting' },
      { title: 'Cancelled Orders', value: '0', icon: XCircle, trend: -12.5, trendLabel: 'this week' },
   ];

   const filterRef = React.useRef<HTMLDivElement>(null);

   const [dashboardData, setDashboardData] = useState<any>(null);
   const [loading, setLoading] = useState(true);

   const stats = dashboardData?.stats ? defaultStats.map(s => {
      const remoteStat = dashboardData.stats.find((rs: any) => rs.title === s.title);
      return remoteStat ? { ...s, value: remoteStat.value } : s;
   }) : defaultStats;

   const fetchDashboardStats = async () => {
      try {
         setLoading(true);
         const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api'}/admin/dashboard/stats`);
         if (res && res.ok) {
            const data = await res.json();
            setDashboardData(data);
         }
      } catch (error) {
         console.error('Failed to fetch dashboard stats', error);
      } finally {
         setLoading(false);
      }
   };

   React.useEffect(() => {
      fetchDashboardStats();

      const handleClickOutside = (event: MouseEvent) => {
         if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
            setActiveDropdown(null);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   return (
      <div className="space-y-6 pb-10">
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
               <h1 className="text-3xl font-black text-gray-900 tracking-tight">Executive Dashboard</h1>
            </div>

            <div ref={filterRef} className="flex flex-wrap items-center gap-3">
                {/* Filters */}
                <div className="relative">
                   <div 
                      onClick={() => toggleDropdown('calendar')}
                      className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-md border rounded-xl shadow-sm cursor-pointer transition-all ${activeDropdown === 'calendar' ? 'bg-white/80 border-blue-200' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}
                   >
                      <Calendar size={12} className="text-blue-600" />
                      <span className="text-[10px] font-bold text-gray-600">{selectedDate}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'calendar' ? 'rotate-180' : ''}`} />
                   </div>
                   
                   <AnimatePresence>
                      {activeDropdown === 'calendar' && (
                         <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 5, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-1 w-64 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-xl z-50 overflow-hidden"
                         >
                            <div className="p-4 space-y-4">
                               <div className="flex items-center justify-between mb-2">
                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Select Period</span>
                               </div>

                               <div className="flex flex-wrap gap-2">
                                  {[
                                     { label: 'Today', days: 0 },
                                     { label: '7 Days', days: 7 },
                                     { label: '30 Days', days: 30 }
                                  ].map(p => (
                                     <button 
                                        key={p.label}
                                        onClick={() => handleQuickSelect(p.days, p.label)}
                                        className="px-2 py-1 bg-blue-50 text-blue-600 text-[8px] font-bold rounded-md hover:bg-blue-600 hover:text-white transition-colors"
                                     >
                                        {p.label}
                                     </button>
                                  ))}
                               </div>
                               
                               <div className="space-y-3 pt-2">
                                  <div className="space-y-1">
                                     <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">From Date</label>
                                     <input 
                                        type="date" 
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                     />
                                  </div>
                                  <div className="space-y-1">
                                     <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">To Date</label>
                                     <input 
                                        type="date" 
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white/50 border border-gray-100 rounded-lg text-[10px] font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                     />
                                  </div>
                               </div>

                               <button 
                                  onClick={handleApplyCustomDate}
                                  disabled={!startDate || !endDate}
                                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale transition-all"
                               >
                                  Apply Range
                               </button>
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>

                <div className="relative">
                   <div 
                      onClick={() => toggleDropdown('category')}
                      className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-md border rounded-xl shadow-sm cursor-pointer transition-all ${activeDropdown === 'category' ? 'bg-white/80 border-blue-200' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}
                   >
                      <LayoutGrid size={12} className="text-blue-600" />
                      <span className="text-[10px] font-bold text-gray-600">{selectedCategory}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
                   </div>

                   <AnimatePresence>
                      {activeDropdown === 'category' && (
                         <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 5, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-1 w-40 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-xl z-50 overflow-hidden"
                         >
                            {categoryOptions.map((option) => (
                               <div 
                                  key={option}
                                  onClick={() => handleSelect(setSelectedCategory, option)}
                                  className="px-4 py-2 text-[10px] font-bold text-gray-600 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors"
                               >
                                  {option}
                               </div>
                            ))}
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>

                <div className="relative">
                   <div 
                      onClick={() => toggleDropdown('location')}
                      className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-md border rounded-xl shadow-sm cursor-pointer transition-all ${activeDropdown === 'location' ? 'bg-white/80 border-blue-200' : 'bg-white/40 border-white/60 hover:bg-white/60'}`}
                   >
                      <MapPin size={12} className="text-blue-600" />
                      <span className="text-[10px] font-bold text-gray-600">{selectedLocation}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'location' ? 'rotate-180' : ''}`} />
                   </div>

                   <AnimatePresence>
                      {activeDropdown === 'location' && (
                         <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 5, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute top-full left-0 mt-1 w-40 bg-white/80 backdrop-blur-xl border border-white/60 rounded-xl shadow-xl z-50 overflow-hidden"
                         >
                            {locationOptions.map((option) => (
                               <div 
                                  key={option}
                                  onClick={() => handleSelect(setSelectedLocation, option)}
                                  className="px-4 py-2 text-[10px] font-bold text-gray-600 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors"
                               >
                                  {option}
                               </div>
                            ))}
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>

               <div className="h-6 w-[1px] bg-gray-200 mx-1" />

                <button 
                   onClick={fetchDashboardStats}
                   disabled={loading}
                   className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50"
                >
                   <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                   <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Sync Data</span>
                </button>
            </div>
         </div>

         <div className="space-y-8">
            {/* KPI Stat Cards Row - Optimised Grid for 6 Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
               {stats.map((stat, i) => (
                  <StatCard key={stat.title} {...stat} index={i} />
               ))}
            </div>

            {/* Provider Subscriptions Breakdown Card */}
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-100 dark:border-gray-700 p-6 rounded-2xl shadow-sm space-y-4">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                     <Briefcase size={18} />
                     <h2 className="text-sm font-black uppercase tracking-wider">Provider Subscriptions Breakdown</h2>
                  </div>
                  <a href="/admin/providers/subscriptions" className="text-xs text-indigo-600 font-bold hover:underline">Manage Subscriptions &rarr;</a>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                     <span className="text-[10px] font-bold text-gray-500 block">Wallet Based</span>
                     <span className="text-lg font-extrabold text-gray-900 dark:text-white">{subStats?.walletBased ?? 0}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                     <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">Free Trial</span>
                     <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{subStats?.freeTrial ?? 0}</span>
                  </div>
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                     <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">Premium Tier</span>
                     <span className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300">{subStats?.premium ?? 0}</span>
                  </div>
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/40">
                     <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 block">Sponsored</span>
                     <span className="text-lg font-extrabold text-purple-700 dark:text-purple-300">{subStats?.sponsored ?? 0}</span>
                  </div>
                  <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-900/40">
                     <span className="text-[10px] font-bold text-amber-600 dark:border-amber-400 block">Expiring This Week</span>
                     <span className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{subStats?.expiringThisWeek ?? 0}</span>
                  </div>
                  <div className="p-3 bg-orange-50/50 dark:bg-orange-950/30 rounded-xl border border-orange-100 dark:border-orange-900/40">
                     <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 block">Grace Period</span>
                     <span className="text-lg font-extrabold text-orange-700 dark:text-orange-300">{subStats?.gracePeriod ?? 0}</span>
                  </div>
                  <div className="p-3 bg-red-50/50 dark:bg-red-950/30 rounded-xl border border-red-100 dark:border-red-900/40">
                     <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block">Expired</span>
                     <span className="text-lg font-extrabold text-red-700 dark:text-red-300">{subStats?.expired ?? 0}</span>
                  </div>
               </div>
            </div>

            {/* Requires Attention Alert Panel */}
            {dashboardData?.stuckBookings && (
               <div className="bg-red-50/30 backdrop-blur-xl border border-red-100 p-6 rounded-2xl shadow-sm relative z-10 space-y-4">
                  <div className="flex items-center gap-2 text-red-600">
                     <ShieldAlert size={18} />
                     <h2 className="text-sm font-black uppercase tracking-wider">Requires Operational Attention</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                     {[
                        { 
                           label: 'Accepted > 2 Hours', 
                           value: dashboardData.stuckBookings.acceptedOver2h || 0,
                           link: '/admin/bookings?filter=accepted',
                           isAlert: (dashboardData.stuckBookings.acceptedOver2h || 0) > 0
                        },
                        { 
                           label: 'Start OTP > 30 Min', 
                           value: dashboardData.stuckBookings.waitingStartOver30m || 0,
                           link: '/admin/bookings?filter=waiting_start_otp',
                           isAlert: (dashboardData.stuckBookings.waitingStartOver30m || 0) > 0
                        },
                        { 
                           label: 'End OTP > 3 Hours', 
                           value: dashboardData.stuckBookings.waitingEndOver3h || 0,
                           link: '/admin/bookings?filter=waiting_end_otp',
                           isAlert: (dashboardData.stuckBookings.waitingEndOver3h || 0) > 0
                        },
                        { 
                           label: 'Searching > 10 Min', 
                           value: dashboardData.stuckBookings.searchingOver10m || 0,
                           link: '/admin/bookings?filter=provider_searching',
                           isAlert: (dashboardData.stuckBookings.searchingOver10m || 0) > 0
                        },
                        { 
                           label: 'Pending Refunds', 
                           value: dashboardData.stuckBookings.pendingRefunds || 0,
                           link: '/admin/refunds?filter=requested',
                           isAlert: (dashboardData.stuckBookings.pendingRefunds || 0) > 0
                        },
                        { 
                           label: 'Pending Payouts', 
                           value: dashboardData.stuckBookings.pendingPayouts || 0,
                           link: '/admin/payouts?filter=pending',
                           isAlert: (dashboardData.stuckBookings.pendingPayouts || 0) > 0
                        }
                     ].map(item => (
                        <a 
                           key={item.label}
                           href={item.link}
                           className={`p-4 rounded-xl border transition-all text-center flex flex-col justify-center items-center gap-1 cursor-pointer ${
                              item.isAlert 
                                 ? 'bg-rose-500 text-white border-rose-600 shadow-md hover:scale-[1.03] active:scale-95' 
                                 : 'bg-white border-gray-100 text-gray-800 hover:border-blue-200'
                           }`}
                        >
                           <span className={`text-[9px] font-black uppercase tracking-wider ${item.isAlert ? 'text-white/80' : 'text-gray-400'}`}>
                              {item.label}
                           </span>
                           <span className="text-xl font-black mt-1">
                              {item.value}
                           </span>
                        </a>
                     ))}
                  </div>
               </div>
            )}

            {/* Row 1: Revenue Trend (Line) + Order Status (Donut) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
               <div className="xl:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10 overflow-hidden">
                  <RevenueChart />
               </div>
               <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10">
                  <OrderDonutChart />
               </div>
            </div>

            {/* Row 2: Booking Trends (Bar) + Service Distribution (Pie) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
               <div className="xl:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10 overflow-hidden">
                  <BookingChart />
               </div>
               <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10">
                  <ServicePieChart />
               </div>
            </div>

            {/* Row 3: Provider Performance + Peak Time Heatmap */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
               <div className="xl:col-span-2 bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10">
                  <ProviderPerformanceChart />
               </div>
               <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-2xl shadow-sm relative z-10">
                  <PeakTimeHeatmap />
               </div>
            </div>

            {/* Row 4: FULL WIDTH Recent Bookings Hub */}
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm overflow-hidden relative z-10">
               <div className="px-6 py-4 border-b border-white/20 flex justify-between items-center bg-white/20">
                  <div className="flex items-center gap-4">
                     <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Recent Bookings Hub</h3>
                     <div className="flex items-center gap-2 group cursor-pointer">
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-bold rounded-full uppercase tracking-tighter group-hover:scale-105 transition-transform">Live Updates</span>
                     </div>
                  </div>
                  <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:translate-x-1 transition-transform">Explore All Bookings →</button>
               </div>
               <table className="w-full text-left border-collapse">
                  <thead className="bg-white/10">
                     <tr>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Client Identity</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Service Requested</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Operation Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Transaction Value</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/20">
                     {(dashboardData?.recentBookings || []).slice(0, 5).map((booking: any) => (
                        <tr key={booking.id} className="hover:bg-white/30 transition-colors group">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[10px] group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">
                                    {booking.client[0]}
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-[13px] font-bold text-gray-800">{booking.client}</span>
                                    <span className="text-[10px] text-gray-400 font-medium tracking-tight uppercase">{booking.id}</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-xs font-semibold text-gray-600 group-hover:text-blue-600 transition-colors">{booking.service}</span>
                                 <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Hover for details</span>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${booking.color === 'green' ? 'bg-green-100/50 text-green-700 border border-green-200/50' :
                                 booking.color === 'blue' ? 'bg-blue-100/50 text-blue-700 border border-blue-200/50' :
                                    'bg-red-100/50 text-red-700 border border-red-200/50'
                                 }`}>
                                 {booking.status}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <span className="text-xs font-black text-gray-900">₹{booking.price}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* Row 5: Reviews + Strategic Alerts & Insights */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
               <ReviewsSnapshot />

               <div className="space-y-6">
                  {/* Dynamic AI Insights / Alerts */}
                  <div className="bg-[#0F172A] p-8 rounded-3xl shadow-2xl text-white relative overflow-hidden group border border-white/5">
                     <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                        <TrendingUp size={160} />
                     </div>
                     <div className="flex items-center gap-3 mb-8">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Operations Control Center</h3>
                     </div>

                     <div className="space-y-6 relative z-10">
                        <motion.div
                           initial={{ x: -20, opacity: 0 }}
                           animate={{ x: 0, opacity: 1 }}
                           className="flex gap-4 group/item cursor-pointer"
                        >
                           <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover/item:bg-blue-500 group-hover/item:text-white transition-all">
                              <ShieldCheck size={20} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Safety Alert</p>
                              <p className="text-[12px] font-bold leading-relaxed mt-1">High cancellation detected in <span className="text-orange-400">AC repair</span> category. Investigate provider availability.</p>
                           </div>
                        </motion.div>

                        <motion.div
                           initial={{ x: -20, opacity: 0 }}
                           animate={{ x: 0, opacity: 1 }}
                           transition={{ delay: 0.2 }}
                           className="flex gap-4 group/item cursor-pointer"
                        >
                           <div className="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 group-hover/item:bg-green-500 group-hover/item:text-white transition-all">
                              <TrendingUp size={20} />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-green-300">Revenue Insight</p>
                              <p className="text-[12px] font-bold leading-relaxed mt-1">Platform service volume is up <span className="text-blue-400">18.2%</span>. Consider increasing provider onboarding incentive.</p>
                           </div>
                        </motion.div>
                     </div>
                  </div>

                  {/* Operational Health Summary */}
                  <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-sm">
                     <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8">Performance Health</h3>
                     <div className="space-y-6">
                        {[
                           { label: 'Provider Availability', value: '184 Providers Online', p: 85, color: 'bg-blue-500' },
                           { label: 'Customer Retention', value: '72% Returning Users', p: 72, color: 'bg-green-500' },
                        ].map(item => (
                           <div key={item.label}>
                              <div className="flex justify-between items-end mb-3">
                                 <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{item.label}</span>
                                 <span className="text-[10px] font-black text-gray-900">{item.value}</span>
                              </div>
                              <div className="h-2 w-full bg-gray-100/50 rounded-full overflow-hidden border border-white/60">
                                 <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.p}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className={`h-full ${item.color} rounded-full`}
                                 />
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
}
