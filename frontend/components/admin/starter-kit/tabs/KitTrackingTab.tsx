"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Package, Clock, ShieldAlert, Search, Download, Eye, X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';
import { message } from 'antd';

interface KitOrderDetails {
  _id: string;
  kitName: string;
  kitSize: string;
  grandTotal: number;
  paymentId: string;
  paidAt: string | null;
  razorpayOrderId: string;
  accessories: Array<{
    name: string;
    quantity: number;
    total_price: number;
  }>;
}

interface ProviderTracking {
  _id: string;
  providerName: string;
  providerPhone: string;
  status: 'Purchased' | 'Pending Payment' | 'Not Purchased';
  purchaseDate: string | null;
  orderId: string;
}

interface Stats {
  purchased: number;
  pendingPayment: number;
  notPurchased: number;
}

export default function KitTrackingTab() {
  const [providers, setProviders] = useState<ProviderTracking[]>([]);
  const [stats, setStats] = useState<Stats>({ purchased: 0, pendingPayment: 0, notPurchased: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<KitOrderDetails | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchTrackingData = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/kit-tracking`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setProviders(data.providers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      if (statusFilter !== 'all' && p.status.toLowerCase().replace(' ', '_') !== statusFilter) return false;
      if (search && !p.providerName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [providers, search, statusFilter]);

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const statusBadge = (status: ProviderTracking['status']) => {
    const map: Record<ProviderTracking['status'], string> = {
      'Purchased': 'bg-green-100 text-green-700 border border-green-200',
      'Pending Payment': 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      'Not Purchased': 'bg-slate-100 text-slate-700 border border-slate-200',
    };
    return map[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  const handleActionClick = async (provider: ProviderTracking) => {
    if (provider.status === 'Purchased') {
      try {
        setLoadingOrder(true);
        // Find order details via kit-purchases API matching orderId or providerId
        const res = await authFetch(`${API_URL}/providers/kit-purchases`);
        if (res.ok) {
          const data = await res.json();
          const order = data.orders.find((o: any) => o.razorpayOrderId === provider.orderId || o._id === provider.orderId);
          if (order) {
            setSelectedOrder({
              _id: order._id,
              kitName: order.kitName,
              kitSize: order.kitSize,
              grandTotal: order.grandTotal,
              paymentId: order.paymentId,
              paidAt: order.paidAt,
              razorpayOrderId: order.razorpayOrderId,
              accessories: order.accessories || []
            });
          } else {
            messageApi.error('Order details not found');
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrder(false);
      }
    } else if (provider.status === 'Pending Payment') {
      messageApi.info(`Followed up with ${provider.providerName} via registered phone: ${provider.providerPhone}`);
    } else {
      messageApi.success(`Sent SMS kit purchase reminder to ${provider.providerName}`);
    }
  };

  const exportCSV = () => {
    const rows = filteredProviders.map(p => ({
      Provider: p.providerName,
      Phone: p.providerPhone,
      Status: p.status,
      'Purchase Date': formatDate(p.purchaseDate),
      'Order ID': p.orderId || 'N/A'
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
    a.download = `kit-tracking-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Loading kit tracking...</div>;

  const statCards = [
    { label: 'Purchased', value: stats.purchased, icon: Package, color: 'text-green-600', bg: 'bg-green-50', desc: 'Payment completed' },
    { label: 'Pending Payment', value: stats.pendingPayment, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', desc: 'Started checkout' },
    { label: 'Not Purchased', value: stats.notPurchased, icon: ShieldAlert, color: 'text-slate-600', bg: 'bg-slate-50', desc: 'No order created' },
  ];

  return (
    <div className="space-y-6">
      {contextHolder}
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-150 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-all duration-300">
              <div className={`p-3.5 rounded-2xl ${s.bg}`}>
                <Icon size={24} className={s.color} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
                <p className="text-2xl font-black text-slate-800 mt-0.5">{s.value}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-black text-slate-850 mr-auto">Provider Kit Tracking</h2>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search provider..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-56 transition-all duration-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all duration-200"
          >
            <option value="all">All Statuses</option>
            <option value="purchased">Purchased</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="not_purchased">Not Purchased</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm shadow-slate-900/10"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Provider Name</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Phone</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Purchase Date</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProviders.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">No tracked providers found.</td></tr>
              ) : filteredProviders.map((p) => (
                <tr key={p._id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4.5">
                    <span className="text-sm font-bold text-slate-800 block">{p.providerName}</span>
                  </td>
                  <td className="px-6 py-4.5 text-sm font-semibold text-slate-600">
                    {p.providerPhone || '—'}
                  </td>
                  <td className="px-6 py-4.5">
                    <span className={`text-xs font-black px-3 py-1.5 rounded-full ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4.5 text-sm font-semibold text-slate-600">
                    {formatDate(p.purchaseDate)}
                  </td>
                  <td className="px-6 py-4.5 text-right">
                    <button
                      disabled={loadingOrder}
                      onClick={() => handleActionClick(p)}
                      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black rounded-xl transition-all shadow-sm ${
                        p.status === 'Purchased'
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 shadow-blue-50/20'
                          : p.status === 'Pending Payment'
                            ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 shadow-yellow-50/20'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {p.status === 'Purchased' ? (
                        <>
                          <Eye size={12} /> View
                        </>
                      ) : p.status === 'Pending Payment' ? (
                        'Follow Up'
                      ) : (
                        'Remind'
                      )}
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

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">Kit Name</span>
                    <span className="font-bold text-slate-800">{selectedOrder.kitName || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">T-Shirt Size</span>
                    <span className="font-bold text-slate-800">{selectedOrder.kitSize || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">Amount Paid</span>
                    <span className="font-bold text-slate-800">₹{selectedOrder.grandTotal?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">Payment ID</span>
                    <span className="font-mono text-xs text-blue-600 font-bold">{selectedOrder.paymentId || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2">
                    <span className="font-semibold text-slate-500">Purchase Date</span>
                    <span className="font-bold text-slate-800">{formatDate(selectedOrder.paidAt)}</span>
                  </div>
                </div>

                {selectedOrder.accessories.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3">Accessories Purchased</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {selectedOrder.accessories.map((acc, i) => (
                        <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-150 p-3 rounded-xl text-sm">
                          <span className="font-semibold text-slate-700">{acc.name} × {acc.quantity}</span>
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
