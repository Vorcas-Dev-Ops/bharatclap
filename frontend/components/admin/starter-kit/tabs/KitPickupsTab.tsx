"use client";

import React, { useState, useEffect } from 'react';
import { PackageCheck, CheckCircle2, ShoppingBag, Eye, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';
import { message } from 'antd';

interface Accessory {
  name: string;
  quantity: number;
  total_price: number;
}

interface KitPickupOrder {
  _id: string;
  providerId: string;
  providerName: string;
  providerPhone: string;
  kitName: string;
  kitSize: string;
  amount: number;
  paymentId: string;
  paidAt: string | null;
  fulfillmentStatus: 'awaiting_approval' | 'ready_for_pickup' | 'collected' | 'completed';
  razorpayOrderId: string;
  accessories: Accessory[];
  createdAt: string;
}

export default function KitPickupsTab() {
  const [pickups, setPickups] = useState<KitPickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<KitPickupOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchPickups = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/kit-pickups`);
      if (res.ok) {
        const data = await res.json();
        setPickups(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPickups();
  }, []);

  const handleStatusTransition = async (orderId: string, nextStatus: KitPickupOrder['fulfillmentStatus']) => {
    try {
      setUpdatingId(orderId);
      const res = await authFetch(`${API_URL}/providers/kit-pickups/${orderId}/fulfillment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: nextStatus })
      });
      if (res.ok) {
        messageApi.success(
          nextStatus === 'ready_for_pickup'
            ? 'Order approved! Provider notified for branch/HUD pickup.'
            : 'Collection confirmed successfully.'
        );
        fetchPickups();
      } else {
        messageApi.error('Failed to update status');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An error occurred');
    } finally {
      setUpdatingId(null);
    }
  };

  const getFulfillmentBadge = (status: KitPickupOrder['fulfillmentStatus']) => {
    const maps: Record<KitPickupOrder['fulfillmentStatus'], { badge: string, label: string }> = {
      awaiting_approval: { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', label: 'Awaiting Approval' },
      ready_for_pickup: { badge: 'bg-blue-100 text-blue-700 border border-blue-200', label: 'Ready for Pickup' },
      collected: { badge: 'bg-green-100 text-green-700 border border-green-200', label: 'Collected' },
      completed: { badge: 'bg-purple-100 text-purple-700 border border-purple-200', label: 'Completed' },
    };
    const details = maps[status] || { badge: 'bg-slate-100 text-slate-700 border border-slate-200', label: status };
    return (
      <span className={`text-xs font-black px-3 py-1.5 rounded-full capitalize ${details.badge}`}>
        {details.label}
      </span>
    );
  };

  const getActionBtn = (order: KitPickupOrder) => {
    const isUpdating = updatingId === order._id;
    if (order.fulfillmentStatus === 'awaiting_approval') {
      return (
        <button
          disabled={isUpdating}
          onClick={() => handleStatusTransition(order._id, 'ready_for_pickup')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm shadow-blue-600/10"
        >
          {isUpdating ? 'Approving...' : 'Approve'}
        </button>
      );
    }
    if (order.fulfillmentStatus === 'ready_for_pickup') {
      return (
        <button
          disabled={isUpdating}
          onClick={() => handleStatusTransition(order._id, 'collected')}
          className="bg-green-600 hover:bg-green-700 text-white text-xs font-black px-4 py-2.5 rounded-xl transition-all duration-200 shadow-sm shadow-green-600/10"
        >
          {isUpdating ? 'Saving...' : 'Confirm Collected'}
        </button>
      );
    }
    return (
      <span className="text-xs font-bold text-slate-400 italic flex items-center justify-end gap-1">
        <CheckCircle2 size={14} className="text-green-500" /> Completed
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Loading pickups...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
      {contextHolder}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-850">HUD / Branch Pickups</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Order ID</th>
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Provider</th>
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Kit Details</th>
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pickups.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">No pickup orders found.</td></tr>
            ) : pickups.map((order) => (
              <tr key={order._id} className="hover:bg-slate-50/40 transition-colors">
                <td className="px-6 py-4.5">
                  <span className="text-xs font-mono font-bold text-blue-600">{order.razorpayOrderId || order._id}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1">{formatDate(order.paidAt)}</p>
                </td>
                <td className="px-6 py-4.5">
                  <span className="text-sm font-bold text-slate-800 block">{order.providerName}</span>
                  <span className="text-xs text-slate-400 font-semibold">{order.providerPhone}</span>
                </td>
                <td className="px-6 py-4.5">
                  <span className="text-sm font-bold text-slate-800 block">{order.kitName || '—'}</span>
                  <span className="text-xs font-bold text-slate-400">Size: {order.kitSize || '—'}</span>
                </td>
                <td className="px-6 py-4.5">
                  <span className="text-sm font-black text-slate-800">₹{order.amount?.toLocaleString('en-IN')}</span>
                </td>
                <td className="px-6 py-4.5">
                  {getFulfillmentBadge(order.fulfillmentStatus)}
                </td>
                <td className="px-6 py-4.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                    <div className="w-36 text-right">
                      {getActionBtn(order)}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal details */}
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
                    <span className="font-semibold text-slate-500">Provider</span>
                    <span className="font-bold text-slate-800">{selectedOrder.providerName}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">T-Shirt Size</span>
                    <span className="font-bold text-slate-800">{selectedOrder.kitSize || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">Fulfillment Status</span>
                    {getFulfillmentBadge(selectedOrder.fulfillmentStatus)}
                  </div>
                  <div className="flex justify-between text-sm border-b border-slate-100 pb-2">
                    <span className="font-semibold text-slate-500">Razorpay Payment ID</span>
                    <span className="font-mono text-xs text-blue-600 font-bold">{selectedOrder.paymentId || '—'}</span>
                  </div>
                  <div className="flex justify-between text-sm pb-2">
                    <span className="font-semibold text-slate-500">Paid At</span>
                    <span className="font-bold text-slate-800">{formatDate(selectedOrder.paidAt)}</span>
                  </div>
                </div>

                {selectedOrder.accessories.length > 0 && (
                  <div className="mb-6">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-3">Included Accessories</p>
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
