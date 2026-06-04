"use client";

import React from 'react';
import Table from '../common/Table';
import Badge from '../common/Badge';
import { Star, TrendingUp, TrendingDown, Users } from 'lucide-react';

const TOP_PROVIDERS = [
  { name: 'Sudheer Kumar', service: 'Electrician', bookings: 145, revenue: '₹45,200', rating: 4.9, trend: 12 },
  { name: 'Amit Sharma', service: 'Plumber', bookings: 124, revenue: '₹38,500', rating: 4.8, trend: 8 },
  { name: 'Rajesh Patil', service: 'AC Repair', bookings: 98, revenue: '₹32,100', rating: 4.7, trend: -3.5 },
  { name: 'Vikram Singh', service: 'Cleaning', bookings: 86, revenue: '₹22,400', rating: 4.6, trend: 5.2 },
];

const SERVICE_INSIGHTS = [
  { service: 'Full Home Cleaning', bookings: 245, revenue: '₹3,45,000', growth: 18.5, status: 'Trending' },
  { service: 'AC Gas Refilling', bookings: 182, revenue: '₹1,45,000', growth: 24.2, status: 'High Demand' },
  { service: 'Switchboard Fixing', bookings: 156, revenue: '₹32,000', growth: -5.4, status: 'Baseline' },
];

const BIDetailedInsights: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
       <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          
          {/* Top Providers Bureau */}
          <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-sm overflow-hidden flex flex-col">
             <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest text-[11px]">Primary Partner Audit</h3>
                   <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 italic leading-none">Best performing providers by value generation</p>
                </div>
                <button className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all shadow-sm">View Full Merit List</button>
             </div>
             
             <div className="flex-1 overflow-x-auto">
                <Table 
                   headers={['Partner Name', 'Vertical', 'Volume', 'Revenue Index', 'Quality Audit', 'Performance']}
                   className="whitespace-nowrap"
                >
                   {TOP_PROVIDERS.map((p) => (
                      <tr key={p.name} className="hover:bg-blue-50/20 transition-all border-b border-gray-50 last:border-0 group/row">
                         <td className="px-6 py-4 font-black text-gray-900 tracking-tight text-[11px] group-hover/row:text-blue-600 truncate max-w-[120px]">{p.name}</td>
                         <td className="px-6 py-4">
                            <span className="text-[9px] font-black text-gray-400 border border-gray-100 px-2 py-0.5 rounded-md uppercase tracking-tight">{p.service}</span>
                         </td>
                         <td className="px-6 py-4 font-black text-gray-900 text-[11px]">{p.bookings} <span className="text-[8px] text-gray-400">OPS</span></td>
                         <td className="px-6 py-4 font-black text-gray-900 text-[12px] tracking-tighter">{p.revenue}</td>
                         <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                               <Star size={10} className="text-yellow-400 fill-yellow-400" />
                               <span className="text-[11px] font-black text-gray-900 tracking-tighter">{p.rating}</span>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className={`flex items-center gap-1 ${p.trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                               {p.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                               <span className="text-[9px] font-black tracking-tight">{Math.abs(p.trend)}%</span>
                            </div>
                         </td>
                      </tr>
                   ))}
                </Table>
             </div>
          </div>

          {/* Service Growth Audit */}
          <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-sm overflow-hidden flex flex-col">
             <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                   <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest text-[11px]">Vertical Growth Index</h3>
                   <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-1 italic leading-none">Market expansion analysis by catalog offering</p>
                </div>
                <button className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-tighter hover:bg-blue-600 hover:text-white transition-all shadow-sm">Audit All Offerings</button>
             </div>

             <div className="flex-1 overflow-x-auto">
                <Table headers={['Subscription Service', 'Transaction Count', 'Revenue Baseline', 'Growth Delta', 'Market Signal']}>
                   {SERVICE_INSIGHTS.map((s) => (
                      <tr key={s.service} className="hover:bg-blue-50/20 transition-all border-b border-gray-50 last:border-0 group/row">
                         <td className="px-6 py-4 font-black text-gray-900 tracking-tight text-[11px] group-hover/row:text-blue-600 truncate max-w-[150px] uppercase">{s.service}</td>
                         <td className="px-6 py-4 font-black text-gray-900 text-[11px]">{s.bookings}</td>
                         <td className="px-6 py-4 font-black text-gray-900 text-[12px] tracking-tighter">{s.revenue}</td>
                         <td className="px-6 py-4">
                            <div className={`flex items-center gap-1 ${s.growth >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                               {s.growth >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                               <span className="text-[10px] font-black tracking-tight">{s.growth >= 0 ? '+' : ''}{s.growth}%</span>
                            </div>
                         </td>
                         <td className="px-6 py-4">
                            <div className="scale-75 origin-left">
                               <Badge variant={s.status === 'Trending' ? 'success' : s.status === 'High Demand' ? 'info' : 'neutral'}>{s.status}</Badge>
                            </div>
                         </td>
                      </tr>
                   ))}
                </Table>
             </div>
          </div>
       </div>

       {/* Customer Insights Rail */}
       <div className="bg-white/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 p-8 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
             <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                <Users size={32} />
             </div>
             <div>
                <h4 className="text-2xl font-black text-gray-900 tracking-tight">Customer Retention Bureau</h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Acquisition vs Retention Intelligence</p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-10">
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap mb-1">New Signups</span>
                <span className="text-2xl font-black text-gray-900">856 <span className="text-[10px] text-green-600 uppercase tracking-tighter">+12%</span></span>
             </div>
             <div className="w-[1px] h-10 bg-gray-100 hidden lg:block" />
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap mb-1">Returning Users</span>
                <span className="text-2xl font-black text-gray-900">1,240 <span className="text-[10px] text-blue-600 uppercase tracking-tighter">65%</span></span>
             </div>
             <div className="w-[1px] h-10 bg-gray-100 hidden lg:block" />
             <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap mb-1">Retention Rate</span>
                <span className="text-3xl font-black text-blue-600 tracking-tighter">74.2%</span>
             </div>
             <button className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-[10px] items-center justify-center font-black uppercase tracking-[0.2em] shadow-lg shadow-black/20 hover:bg-blue-600 transition-all active:scale-95">Download CRM Intelligence Report</button>
          </div>
       </div>
    </div>
  );
};

export default BIDetailedInsights;
