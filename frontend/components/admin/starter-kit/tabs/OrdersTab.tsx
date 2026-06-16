"use client";

import React, { useState } from 'react';
import { Eye, Truck, FileText, Download } from 'lucide-react';

export default function OrdersTab() {
  const [orders] = useState([
    { id: 'KITORDER001', provider: 'John Doe', service: 'Electrician', size: 'M', amount: 895, payment: 'Paid', status: 'Delivered', date: '2026-06-12' },
    { id: 'KITORDER002', provider: 'David Smith', service: 'Plumber', size: 'XL', amount: 895, payment: 'Pending', status: 'Pending', date: '2026-06-12' },
    { id: 'KITORDER003', provider: 'Anita Sharma', service: 'Cleaning', size: 'S', amount: 0, payment: 'Waived', status: 'Processing', date: '2026-06-11' },
    { id: 'KITORDER004', provider: 'Rahul Verma', service: 'Carpenter', size: 'L', amount: 895, payment: 'Paid', status: 'Shipped', date: '2026-06-10' },
  ]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Recent Kit Orders</h2>
        <input type="text" placeholder="Search orders..." className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Order ID</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Provider</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Service & Size</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-blue-600">{order.id}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{order.date}</p>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{order.provider}</td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-800 block">{order.service}</span>
                  <span className="text-xs text-slate-500 font-medium">Size: {order.size}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-800 block">₹{order.amount}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    order.payment === 'Paid' ? 'bg-green-100 text-green-700' :
                    order.payment === 'Waived' ? 'bg-purple-100 text-purple-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {order.payment}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                    order.status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'Processing' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Update Delivery">
                      <Truck size={16} />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Generate Invoice">
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
