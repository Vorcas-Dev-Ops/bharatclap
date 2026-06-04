"use client";

import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

const REVENUE_DATA = [
  { name: 'Mon', current: 4000, previous: 2400 },
  { name: 'Tue', current: 3000, previous: 1398 },
  { name: 'Wed', current: 2000, previous: 9800 },
  { name: 'Thu', current: 2780, previous: 3908 },
  { name: 'Fri', current: 1890, previous: 4800 },
  { name: 'Sat', current: 2390, previous: 3800 },
  { name: 'Sun', current: 3490, previous: 4300 },
];

const BOOKING_DATA = [
  { name: 'Jan', bookings: 400 },
  { name: 'Feb', bookings: 300 },
  { name: 'Mar', bookings: 600 },
  { name: 'Apr', bookings: 800 },
  { name: 'May', bookings: 500 },
  { name: 'Jun', bookings: 900 },
];

const SERVICE_DATA = [
  { name: 'Cleaning', value: 35 },
  { name: 'Electrician', value: 25 },
  { name: 'AC Repair', value: 20 },
  { name: 'Carpenter', value: 10 },
  { name: 'Painting', value: 10 },
];

const COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#e11d48'];

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/60 shadow-sm flex flex-col min-h-[400px]">
    <div className="mb-8 flex items-center justify-between">
      <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest text-[11px]">{title}</h3>
      <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View Analytics</button>
    </div>
    <div className="flex-1 w-full min-h-[250px]">
       {children}
    </div>
  </div>
);

const BIChartsGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
       {/* 1. Revenue Visualization - Line Chart */}
       <ChartCard title="Revenue Performance Index">
          <ResponsiveContainer width="100%" height="100%">
             <LineChart data={REVENUE_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} dy={10} />
                <YAxis fontSize={10} fontWeight={800} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                   labelStyle={{ fontWeight: 800, color: '#111827', textTransform: 'uppercase', fontSize: '10px' }}
                />
                <Line type="monotone" dataKey="current" stroke="#2563eb" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 8 }} name="Current Period" />
                <Line type="monotone" dataKey="previous" stroke="#e5e7eb" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Previous Period" />
             </LineChart>
          </ResponsiveContainer>
       </ChartCard>

       {/* 2. Customer Growth Visualization - Area Chart */}
       <ChartCard title="Capability & User Growth">
          <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={REVENUE_DATA}>
                <defs>
                   <linearGradient id="colorUser" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                   </linearGradient>
                </defs>
                <XAxis dataKey="name" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                <Tooltip 
                   contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px', border: 'none' }}
                />
                <Area type="monotone" dataKey="current" stroke="#7c3aed" fillOpacity={1} fill="url(#colorUser)" strokeWidth={3} />
             </AreaChart>
          </ResponsiveContainer>
       </ChartCard>

       {/* 3. Booking Trends Visualization - Bar Chart */}
       <ChartCard title="Transactional Momentum">
          <ResponsiveContainer width="100%" height="100%">
             <BarChart data={BOOKING_DATA}>
                <XAxis dataKey="name" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} fontWeight={800} axisLine={false} tickLine={false} />
                <Tooltip 
                   cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }}
                   contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '16px', border: 'none' }}
                />
                <Bar dataKey="bookings" fill="#2563eb" radius={[10, 10, 10, 10]} barSize={20} />
             </BarChart>
          </ResponsiveContainer>
       </ChartCard>

       {/* 4. Vertical Distribution - Pie Chart */}
       <ChartCard title="Domain Demand Distribution">
          <div className="flex items-center justify-between h-full">
            <ResponsiveContainer width="60%" height="100%">
               <PieChart>
                  <Pie
                    data={SERVICE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {SERVICE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
               </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] flex flex-col gap-3">
               {SERVICE_DATA.map((entry, index) => (
                 <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                       <span className="text-[10px] font-black text-gray-700 uppercase">{entry.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-gray-400">{entry.value}%</span>
                 </div>
               ))}
            </div>
          </div>
       </ChartCard>

       {/* 5. Top Providers Analysis - Horizontal Bar Chart */}
       <ChartCard title="Strategic Partner Performance">
          <ResponsiveContainer width="100%" height="100%">
             <BarChart layout="vertical" data={[
               { name: 'Sudheer Kumar', revenue: 45000 },
               { name: 'Amit Sharma', revenue: 38000 },
               { name: 'Rajesh Patil', revenue: 32000 },
               { name: 'Vikram Singh', revenue: 28000 },
             ]}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" fontSize={10} fontWeight={800} axisLine={false} tickLine={false} width={100} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#0891b2" radius={[0, 10, 10, 0]} barSize={12} />
             </BarChart>
          </ResponsiveContainer>
       </ChartCard>

       {/* 6. AI Insights Panel */}
       <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-blue-100 shadow-lg shadow-blue-600/5 flex flex-col">
          <div className="mb-6 flex items-center justify-between">
             <div className="flex items-center gap-2">
               <TrendingUp size={18} className="text-blue-600" />
               <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest text-[11px]">Intelligent Predictions</h3>
             </div>
             <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">Live Audit</span>
          </div>
          
          <div className="space-y-4">
             <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100 flex items-start gap-3">
                <CheckCircle2 size={16} className="text-green-600 mt-0.5" />
                <div>
                   <p className="text-[11px] font-black text-green-900 uppercase tracking-tight">Market Expansion identified</p>
                   <p className="text-[10px] text-green-700 mt-1 font-medium leading-relaxed">Cleaning services in Mumbai have increased by 15% this week. Consider prioritizing onboarding in this vertical.</p>
                </div>
             </div>
             <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 flex items-start gap-3">
                <AlertCircle size={16} className="text-orange-600 mt-0.5" />
                <div>
                   <p className="text-[11px] font-black text-orange-900 uppercase tracking-tight">Vertical Halted Alert</p>
                   <p className="text-[10px] text-orange-700 mt-1 font-medium leading-relaxed">AC Repair volume is 8% lower than previous month baseline. Regional weather shifts detected.</p>
                </div>
             </div>
          </div>

          <div className="mt-8 flex-1 flex flex-col justify-end">
             <button className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] items-center justify-center font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-600/20 flex gap-2 group">
                Download Detailed SWOT Analysis
                <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
       </div>
    </div>
  );
};

export default BIChartsGrid;
