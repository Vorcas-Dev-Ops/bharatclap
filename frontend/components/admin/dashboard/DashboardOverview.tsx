"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StatCard from './StatCard';
import BookingChart from './BookingChart';
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
   LayoutGrid,
   ShieldAlert,
   Activity,
   TrendingUp,
   CheckCircle2,
   Percent,
   IndianRupee,
   Clock
} from 'lucide-react';
import { authFetch } from '@/utils/authFetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000/api';

const formatINR = (val: number) => {
   if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
   if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
   if (val >= 1000) return `₹${val.toLocaleString('en-IN')}`;
   if (val > 0) return `₹${val}`;
   return '₹0';
};

export default function DashboardOverview() {
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
   const [categoryOptions, setCategoryOptions] = useState<string[]>(['All Categories']);
   const [locationOptions, setLocationOptions] = useState<string[]>(['All Locations']);
   const [subStats, setSubStats] = useState<any>(null);

   React.useEffect(() => {
      // Fetch categories from catalog-service
      const fetchCategories = async () => {
         try {
            const res = await authFetch(`${API_BASE}/categories`);
            if (res.ok) {
               const data = await res.json();
               const cats = (Array.isArray(data) ? data : data.categories || [])
                  .map((c: any) => c.category_name || c.name)
                  .filter(Boolean);
               setCategoryOptions(['All Categories', ...cats]);
            }
         } catch (err) {
            console.error('Failed to fetch categories:', err);
         }
      };
      const fetchAreas = async () => {
         try {
            const res = await authFetch(`${API_BASE}/locations?type=area`);
            if (res.ok) {
               const data = await res.json();
               const areaNames = data.map((loc: any) => loc.name);
               const uniqueAreas = Array.from(new Set(areaNames)).filter(Boolean) as string[];
               setLocationOptions(['All Locations', ...uniqueAreas]);
            }
         } catch (err) {
            console.error('Failed to fetch areas:', err);
         }
      };
      const fetchSubStats = async () => {
         try {
            const res = await authFetch(`${API_BASE}/providers/admin/subscription-stats`);
            if (res.ok) {
               const data = await res.json();
               setSubStats(data);
            }
         } catch (err) {
            console.error('Failed to fetch subscription stats:', err);
         }
      };
      fetchCategories();
      fetchAreas();
      fetchSubStats();
   }, []);

   const filterRef = React.useRef<HTMLDivElement>(null);

   const [dashboardData, setDashboardData] = useState<any>(null);
   const [loading, setLoading] = useState(true);
   const [errorState, setErrorState] = useState<string | null>(null);

   const rawData = dashboardData?.data || dashboardData;

   const fetchDashboardStats = async () => {
      try {
         setLoading(true);
         setErrorState(null);
         const queryParams = new URLSearchParams();
         if (startDate) queryParams.append('startDate', startDate);
         if (endDate) queryParams.append('endDate', endDate);
         if (selectedCategory && selectedCategory !== 'All Categories') queryParams.append('category', selectedCategory);
         if (selectedLocation && selectedLocation !== 'All Locations') queryParams.append('location', selectedLocation);
         const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
         const res = await authFetch(`${API_BASE}/admin/dashboard/stats${queryStr}`);
         if (res && res.ok) {
            const data = await res.json();
            setDashboardData(data);
         } else {
            setErrorState(`HTTP ${res.status}: Failed loading dashboard statistics`);
         }
      } catch (error: any) {
         console.error('Failed to fetch dashboard stats', error);
         setErrorState(error?.message || 'Network error loading metrics');
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
   }, [selectedCategory, selectedLocation, startDate, endDate]);

   // Executive KPI cards â€” Row 1: Business Pulse, Row 2: Platform Health
   const kpiRow1 = [
      {
         title: "Today's Revenue",
         value: formatINR(rawData?.todayRevenue || 0),
         icon: IndianRupee,
         description: 'Platform commission today',
         link: '/admin/finance',
      },
      {
         title: "Today's Bookings",
         value: String(rawData?.todayBookings || 0),
         icon: CalendarCheck,
         description: 'Bookings created today',
         link: '/admin/bookings?filter=today',
      },
      {
         title: 'Active Bookings',
         value: String(rawData?.activeBookings || 0),
         icon: Activity,
         description: 'Currently in progress',
         link: '/admin/bookings?filter=active',
      },
      {
         title: 'Completion Rate',
         value: `${rawData?.completionRate || 0}%`,
         icon: Percent,
         description: 'Completed vs eligible',
      },
   ];

   const kpiRow2 = [
      {
         title: 'Total Customers',
         value: Number(rawData?.totalCustomers || 0).toLocaleString('en-IN'),
         icon: Users,
         link: '/admin/customers',
      },
      {
         title: 'Verified Providers',
         value: Number(rawData?.verifiedProviders || 0).toLocaleString('en-IN'),
         icon: Briefcase,
         description: `${rawData?.pendingVerification || 0} pending verification`,
         link: '/admin/providers',
      },
      {
         title: 'Pending Settlements',
         value: String(rawData?.pendingSettlements || 0),
         icon: Clock,
         link: '/admin/finance/settlements',
      },
      {
         title: 'Cancelled Today',
         value: String(rawData?.cancelledToday || 0),
         icon: XCircle,
         link: '/admin/bookings?filter=cancelled',
      },
   ];

   const stuckBookings = rawData?.stuckBookings;
   const hasAlerts = stuckBookings && Object.values(stuckBookings).some((v: any) => v > 0);

   return (
      <div className="space-y-6 pb-10">
         {/* â”€â”€ Header â”€â”€ */}
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
            <div className="min-w-0">
               <h1 className="text-3xl font-black text-gray-900 tracking-tight">Executive Dashboard</h1>
               {rawData?.grossRevenue !== undefined && (
                  <p className="text-[11px] text-gray-400 mt-1.5 font-semibold tracking-wide">
                     Gross Booking Value: <span className="text-gray-600 font-bold">{formatINR(rawData.grossRevenue)}</span>
                     <span className="mx-1.5 text-gray-300">&middot;</span>
                     Platform Revenue: <span className="text-gray-600 font-bold">{formatINR(rawData.platformRevenue || 0)}</span>
                     <span className="mx-1.5 text-gray-300">&middot;</span>
                     Provider Earnings: <span className="text-gray-600 font-bold">{formatINR(rawData.providerEarnings || 0)}</span>
                  </p>
               )}
            </div>

            <div ref={filterRef} className="flex items-center gap-2 shrink-0">
                {/* Date Filter */}
                <div className="relative">
                   <div onClick={() => toggleDropdown('calendar')}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer transition-all ${activeDropdown === 'calendar' ? 'bg-white border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <Calendar size={13} className="text-blue-600" />
                      <span className="text-xs font-bold text-gray-700">{selectedDate}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'calendar' ? 'rotate-180' : ''}`} />
                   </div>
                   <AnimatePresence>
                      {activeDropdown === 'calendar' && (
                         <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 4 }} exit={{ opacity: 0, y: 8 }}
                            className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                            <div className="p-4 space-y-4">
                               <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Select Period</span>
                               <div className="flex flex-wrap gap-2">
                                  {[{ label: 'Today', days: 0 }, { label: 'Yesterday', days: 1 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 }, { label: '90 Days', days: 90 }].map(p => (
                                     <button key={p.label} onClick={() => handleQuickSelect(p.days, p.label)}
                                        className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-colors">{p.label}</button>
                                  ))}
                               </div>
                               <div className="space-y-2 pt-2">
                                  <div><label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">From</label>
                                     <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                                  <div><label className="text-[8px] font-black text-gray-400 uppercase tracking-widest">To</label>
                                     <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20" /></div>
                               </div>
                               <button onClick={handleApplyCustomDate} disabled={!startDate || !endDate}
                                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-50 transition-all">Apply Range</button>
                            </div>
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
                {/* Category Filter */}
                <div className="relative">
                   <div onClick={() => toggleDropdown('category')}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer transition-all ${activeDropdown === 'category' ? 'bg-white border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <LayoutGrid size={13} className="text-blue-600" />
                      <span className="text-xs font-bold text-gray-700">{selectedCategory}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
                   </div>
                   <AnimatePresence>
                      {activeDropdown === 'category' && (
                         <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 4 }} exit={{ opacity: 0, y: 8 }}
                            className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                            {categoryOptions.map(option => (
                               <div key={option} onClick={() => handleSelect(setSelectedCategory, option)}
                                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors">{option}</div>
                            ))}
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
                {/* Location Filter */}
                <div className="relative">
                   <div onClick={() => toggleDropdown('location')}
                      className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer transition-all ${activeDropdown === 'location' ? 'bg-white border-blue-200 shadow-sm' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                      <MapPin size={13} className="text-blue-600" />
                      <span className="text-xs font-bold text-gray-700">{selectedLocation}</span>
                      <ChevronDown size={12} className={`text-gray-400 transition-transform duration-200 ${activeDropdown === 'location' ? 'rotate-180' : ''}`} />
                   </div>
                   <AnimatePresence>
                      {activeDropdown === 'location' && (
                         <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 4 }} exit={{ opacity: 0, y: 8 }}
                            className="absolute top-full right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50">
                            {locationOptions.map(option => (
                               <div key={option} onClick={() => handleSelect(setSelectedLocation, option)}
                                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-blue-600 hover:text-white cursor-pointer transition-colors">{option}</div>
                            ))}
                         </motion.div>
                      )}
                   </AnimatePresence>
                </div>
               <div className="h-7 w-px bg-gray-200 mx-1" />
                <button onClick={fetchDashboardStats} disabled={loading}
                   className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200/50 hover:scale-105 active:scale-95 transition-transform flex items-center gap-2 disabled:opacity-50">
                   <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                   <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Refresh</span>
                </button>
            </div>
         </div>

         <div className="space-y-6">
            {/* â”€â”€ Section 1: KPI Cards â”€â”€ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {kpiRow1.map((stat, i) => (
                  <a key={stat.title} href={stat.link || '#'} className={stat.link ? 'cursor-pointer' : 'cursor-default'}>
                     <StatCard {...stat} index={i} />
                  </a>
               ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {kpiRow2.map((stat, i) => (
                  <a key={stat.title} href={stat.link || '#'} className={stat.link ? 'cursor-pointer' : 'cursor-default'}>
                     <StatCard {...stat} index={i + 4} />
                  </a>
               ))}
            </div>

            {/* â”€â”€ Section 2: Revenue + Order Status + Service Distribution (3-col) â”€â”€ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Revenue Breakdown</h3>
                  <div className="space-y-5">
                     {[
                        { label: 'Gross Booking Value', value: formatINR(rawData?.grossRevenue || 0), p: 100, color: 'bg-blue-500' },
                        { label: 'Platform Revenue', value: formatINR(rawData?.platformRevenue || 0), p: rawData?.grossRevenue > 0 ? Math.round((rawData.platformRevenue / rawData.grossRevenue) * 100) : 0, color: 'bg-emerald-500' },
                        { label: 'Provider Earnings', value: formatINR(rawData?.providerEarnings || 0), p: rawData?.grossRevenue > 0 ? Math.round((rawData.providerEarnings / rawData.grossRevenue) * 100) : 0, color: 'bg-purple-500' },
                     ].map(item => (
                        <div key={item.label}>
                           <div className="flex justify-between items-end mb-2">
                              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">{item.label}</span>
                              <span className="text-xs font-black text-gray-900">{item.value}</span>
                           </div>
                           <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${item.p}%` }} transition={{ duration: 1.5, ease: "easeOut" }}
                                 className={`h-full ${item.color} rounded-full`} />
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                  <OrderDonutChart />
               </div>
               <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                  <ServicePieChart />
               </div>
            </div>

            {/* â”€â”€ Section 3: Operational Alerts â”€â”€ */}
            {stuckBookings && (
               <div className={`border p-6 rounded-2xl shadow-sm space-y-4 ${hasAlerts ? 'bg-red-50/40 border-red-200' : 'bg-emerald-50/40 border-emerald-200'}`}>
                  <div className={`flex items-center gap-2 ${hasAlerts ? 'text-red-600' : 'text-emerald-600'}`}>
                     <ShieldAlert size={18} />
                     <h2 className="text-sm font-black uppercase tracking-wider">{hasAlerts ? 'Requires Operational Attention' : 'All Systems Normal'}</h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                     {[
                        { label: 'Accepted > 2h', value: stuckBookings.acceptedOver2h || 0, link: '/admin/bookings?filter=accepted' },
                        { label: 'Start OTP > 30m', value: stuckBookings.waitingStartOver30m || 0, link: '/admin/bookings?filter=waiting_start_otp' },
                        { label: 'End OTP > 3h', value: stuckBookings.waitingEndOver3h || 0, link: '/admin/bookings?filter=waiting_end_otp' },
                        { label: 'Searching > 10m', value: stuckBookings.searchingOver10m || 0, link: '/admin/bookings?filter=provider_searching' },
                        { label: 'Pending Refunds', value: stuckBookings.pendingRefunds || 0, link: '/admin/refunds?filter=requested' },
                        { label: 'Pending Payouts', value: stuckBookings.pendingPayouts || 0, link: '/admin/payouts?filter=pending' },
                     ].map(item => (
                        <a key={item.label} href={item.link}
                           className={`p-3 rounded-xl border transition-all text-center flex flex-col justify-center items-center gap-1 cursor-pointer ${
                              item.value > 0 ? 'bg-rose-50 border-rose-300 hover:scale-[1.03]' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
                           <span className={`text-[9px] font-black uppercase tracking-wider ${item.value > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{item.label}</span>
                           <span className={`text-xl font-black ${item.value > 0 ? 'text-rose-700' : 'text-gray-900'}`}>{item.value}</span>
                        </a>
                     ))}
                  </div>
               </div>
            )}

            {/* â”€â”€ Section 4: Booking Trends + Subscriptions â”€â”€ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               <div className="xl:col-span-2 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm overflow-hidden">
                  <BookingChart />
               </div>
               <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-indigo-600">
                        <Briefcase size={16} />
                        <h2 className="text-[10px] font-black uppercase tracking-widest">Subscriptions</h2>
                     </div>
                     <a href="/admin/providers/subscriptions" className="text-[10px] text-indigo-600 font-bold hover:underline">Manage &rarr;</a>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     {[
                        { label: 'Wallet Based', value: subStats?.walletBased ?? 0, bg: 'bg-gray-50', text: 'text-gray-600', val: 'text-gray-900', link: '/admin/providers/subscriptions?filter=wallet_based' },
                        { label: 'Free Trial', value: subStats?.freeTrial ?? 0, bg: 'bg-emerald-50', text: 'text-emerald-600', val: 'text-emerald-700', link: '/admin/providers/subscriptions?filter=free_trial' },
                        { label: 'Premium', value: subStats?.premium ?? 0, bg: 'bg-indigo-50', text: 'text-indigo-600', val: 'text-indigo-700', link: '/admin/providers/subscriptions?filter=premium' },
                        { label: 'Sponsored', value: subStats?.sponsored ?? 0, bg: 'bg-purple-50', text: 'text-purple-600', val: 'text-purple-700', link: '/admin/providers/subscriptions?filter=sponsored' },
                        { label: 'Expiring', value: subStats?.expiringThisWeek ?? 0, bg: 'bg-amber-50', text: 'text-amber-600', val: 'text-amber-700', link: '/admin/providers/subscriptions?filter=expiring' },
                        { label: 'Grace Period', value: subStats?.gracePeriod ?? 0, bg: 'bg-orange-50', text: 'text-orange-600', val: 'text-orange-700', link: '/admin/providers/subscriptions?filter=grace_period' },
                        { label: 'Expired', value: subStats?.expired ?? 0, bg: 'bg-red-50', text: 'text-red-600', val: 'text-red-700', link: '/admin/providers/subscriptions?filter=expired' },
                     ].map(s => (
                        <a key={s.label} href={s.link} className={`${s.bg} p-3 rounded-xl border border-transparent hover:ring-2 hover:ring-gray-200 transition-all text-center block`}>
                           <span className={`text-[9px] font-bold ${s.text} block uppercase tracking-wider`}>{s.label}</span>
                           <span className={`text-lg font-extrabold ${s.val}`}>{s.value}</span>
                        </a>
                     ))}
                  </div>
               </div>
            </div>

            {/* â”€â”€ Section 5: Provider Performance + Reviews â”€â”€ */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
               <div className="xl:col-span-2 bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
                  <ProviderPerformanceChart />
               </div>
               <ReviewsSnapshot />
            </div>

            {/* â”€â”€ Section 6: Peak Time Heatmap â”€â”€ */}
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
               <PeakTimeHeatmap />
            </div>

            {/* â”€â”€ Section 7: Recent Bookings â”€â”€ */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
               <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Recent Bookings</h3>
                  <a href="/admin/bookings" className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:translate-x-1 transition-transform">View All &rarr;</a>
               </div>
               {(rawData?.recentBookings || []).length === 0 ? (
                  <div className="px-6 py-12 text-center">
                     <CalendarCheck size={32} className="mx-auto text-gray-300 mb-3" />
                     <p className="text-sm text-gray-400 font-medium">No recent bookings found</p>
                     <p className="text-xs text-gray-300 mt-1">Bookings will appear here as they are created</p>
                  </div>
               ) : (
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-gray-50/60">
                        <tr>
                           <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
                           <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Service</th>
                           <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                           <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {(rawData?.recentBookings || []).slice(0, 8).map((booking: any) => (
                           <tr key={booking.id || booking._id || booking.booking_id}
                              className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                              onClick={() => window.location.href = `/admin/bookings/${booking.id || booking._id || booking.booking_id}`}>
                              <td className="px-6 py-3.5">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[10px] group-hover:bg-blue-600 group-hover:text-white transition-colors uppercase">
                                       {booking.client?.[0] || '?'}
                                    </div>
                                    <div className="flex flex-col">
                                       <span className="text-[13px] font-bold text-gray-800">{booking.client}</span>
                                       <span className="text-[10px] text-gray-400 font-medium tracking-tight uppercase">{booking.id}</span>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-3.5">
                                 <span className="text-xs font-semibold text-gray-600">{booking.service}</span>
                              </td>
                              <td className="px-6 py-3.5 text-center">
                                 <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    booking.color === 'green' ? 'bg-green-100/80 text-green-700' :
                                    booking.color === 'blue' ? 'bg-blue-100/80 text-blue-700' :
                                    'bg-red-100/80 text-red-700'}`}>
                                    {booking.status}
                                 </span>
                              </td>
                              <td className="px-6 py-3.5 text-right">
                                 <span className="text-xs font-black text-gray-900">₹{booking.price?.toLocaleString('en-IN') || 0}</span>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               )}
            </div>
         </div>
      </div>
   );
}

