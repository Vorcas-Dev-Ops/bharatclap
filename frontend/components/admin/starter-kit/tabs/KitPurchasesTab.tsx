"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Clock, IndianRupee, Search, Download, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

interface Accessory {
  accessory_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface KitOrder {
  _id: string;
  providerName: string;
  providerPhone: string;
  paymentStatus: string;
  kitName: string;
  kitSize: string;
  amount: number;
  grandTotal: number;
  accessories: Accessory[];
  paymentId: string;
  paidAt: string | null;
  razorpayOrderId: string;
  createdAt: string;
}

interface Stats {
  totalKitsSold: number;
  pendingOrders: number;
  totalRevenue: number;
}

export default function KitPurchasesTab() {
  const [orders, setOrders] = useState<KitOrder[]>([]);
  const [stats, setStats] = useState<Stats>({ totalKitsSold: 0, pendingOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<KitOrder | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/providers/kit-purchases`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
          setOrders(data.orders);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.paymentStatus !== statusFilter) return false;
      if (search && !o.providerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [orders, search, statusFilter]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      skipped: 'bg-purple-100 text-purple-700',
      failed: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-slate-100 text-slate-700';
  };

  const exportCSV = () => {
    const rows = filtered.map(o => ({
      Provider: o.providerName,
      Phone: o.providerPhone,
      Status: o.paymentStatus,
      Kit: o.kitName,
      Size: o.kitSize,
      Amount: o.grandTotal,
      'Purchase Date': o.paymentStatus === 'paid' ? formatDate(o.paidAt) : formatDate(o.createdAt),
      'Order ID': o.razorpayOrderId,
      'Payment ID': o.paymentId,
    }));
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${(r as any)[h] ?? ''}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kit-purchases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Loading kit purchases...</div>;

  const statCards = [
    { label: 'Total Kits Sold', value: stats.totalKitsSold, icon: Package, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Pending Orders', value: stats.pendingOrders, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Kit Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.bg}`}>
                <Icon size={22} className={s.color} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{s.label}</p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-slate-800 mr-auto">Kit Purchase History</h2>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="skipped">Skipped</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Provider</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Purchase Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Order ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No kit purchases found.</td></tr>
              ) : filtered.map((order) => (
                <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-800 block">{order.providerName}</span>
                    <span className="text-xs text-slate-400">{order.providerPhone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusBadge(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">₹{order.grandTotal?.toLocaleString('en-IN') || 0}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">
                    {order.paymentStatus === 'paid' ? formatDate(order.paidAt) : formatDate(order.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-blue-600">{order.razorpayOrderId || '—'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Order Details</h3>
                    <p className="text-sm font-bold text-slate-400 mt-1">{selectedOrder.razorpayOrderId || selectedOrder._id}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Provider</p>
                    <p className="font-black text-slate-800 text-lg">{selectedOrder.providerName}</p>
                    <p className="text-sm font-medium text-slate-600">{selectedOrder.providerPhone}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Status</p>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${statusBadge(selectedOrder.paymentStatus)}`}>
                      {selectedOrder.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Kit</span>
                    <span className="font-bold text-slate-800">{selectedOrder.kitName || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Size</span>
                    <span className="font-bold text-slate-800">{selectedOrder.kitSize || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Amount</span>
                    <span className="font-bold text-slate-800">₹{selectedOrder.grandTotal?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Date</span>
                    <span className="font-bold text-slate-800">{selectedOrder.paymentStatus === 'paid' ? formatDate(selectedOrder.paidAt) : formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  {selectedOrder.paymentId && (
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-500">Payment ID</span>
                      <span className="font-mono text-xs text-blue-600">{selectedOrder.paymentId}</span>
                    </div>
                  )}
                </div>

                {selectedOrder.accessories.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3">Accessories</p>
                    <div className="space-y-2">
                      {selectedOrder.accessories.map((acc, i) => (
                        <div key={i} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-xl text-sm">
                          <span className="font-medium text-slate-700">{acc.name} × {acc.quantity}</span>
                          <span className="font-bold text-slate-800">₹{acc.total_price?.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={() => setSelectedOrder(null)} className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors">Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
