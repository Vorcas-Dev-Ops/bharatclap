"use client";

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Eye, Truck, FileText, Download, X, PackageCheck, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

export default function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const fetchOrders = async () => {
    try {
      const res = await authFetch(`${API_URL}/kit-orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeModal, setActiveModal] = useState<'view' | 'delivery' | 'invoice' | null>(null);

  const openModal = (type: 'view' | 'delivery' | 'invoice', order: any) => {
    setSelectedOrder(order);
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setTimeout(() => setSelectedOrder(null), 300); // clear after exit animation
  };

  const handleUpdateShipping = async () => {
    try {
      const res = await authFetch(`${API_URL}/kit-orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedOrder.status,
          courier: selectedOrder.courier,
          trackingId: selectedOrder.trackingId
        })
      });
      if (res.ok) {
        messageApi.success('Shipping details updated successfully');
        fetchOrders();
        closeModal();
      } else {
        messageApi.error('Failed to update shipping details');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An error occurred');
    }
  };

  if (loading) return <div className="p-8 text-center font-bold text-slate-500">Loading orders...</div>;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
      {contextHolder}
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
            {orders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">No kit orders found.</td></tr>
            ) : orders.map((order) => (
              <tr key={order._id || order.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-blue-600">{order.orderId || order.id}</span>
                  <p className="text-[10px] text-slate-400 mt-0.5">{order.date ? new Date(order.date).toLocaleDateString() : ''}</p>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">{order.providerName || order.provider}</td>
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
                    <button onClick={() => openModal('view', order)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details">
                      <Eye size={16} />
                    </button>
                    <button onClick={() => openModal('delivery', order)} className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Update Delivery">
                      <Truck size={16} />
                    </button>
                    <button onClick={() => openModal('invoice', order)} className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Generate Invoice">
                      <FileText size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals Overlay */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <style>{`
              .white-scrollbar::-webkit-scrollbar {
                width: 6px;
                background-color: transparent;
              }
              .white-scrollbar::-webkit-scrollbar-track {
                background-color: transparent;
                margin-top: 16px;
                margin-bottom: 16px;
              }
              .white-scrollbar::-webkit-scrollbar-thumb {
                background-color: #cbd5e1;
                border-radius: 10px;
              }
              .white-scrollbar::-webkit-scrollbar-thumb:hover {
                background-color: #94a3b8;
              }
            `}</style>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="max-h-[85vh] overflow-y-auto white-scrollbar mr-1 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
              {/* === VIEW DETAILS MODAL === */}
              {activeModal === 'view' && selectedOrder && (
                <div className="p-8 pb-12">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800">Order Details</h3>
                      <p className="text-sm font-bold text-slate-400 mt-1">ID: {selectedOrder.orderId || selectedOrder.id}</p>
                    </div>
                    <button onClick={closeModal} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Provider Details</p>
                      <p className="font-black text-slate-800 text-lg">{selectedOrder.providerName || selectedOrder.provider}</p>
                      <p className="text-sm font-medium text-slate-600">{selectedOrder.phone}</p>
                      <p className="text-sm font-medium text-slate-600 mt-2">{selectedOrder.address}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Kit Configuration</p>
                      <p className="text-sm font-medium text-slate-600">Service: <span className="font-bold text-slate-800">{selectedOrder.service}</span></p>
                      <p className="text-sm font-medium text-slate-600">T-Shirt Size: <span className="font-black text-blue-600 text-lg ml-1">{selectedOrder.size}</span></p>
                      <div className="mt-3">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          selectedOrder.payment === 'Paid' ? 'bg-green-100 text-green-700' :
                          selectedOrder.payment === 'Waived' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>Payment: {selectedOrder.payment}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-8">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4">Included Items</p>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 p-3 rounded-xl"><PackageCheck size={18} className="text-blue-500"/> Fixvo Uniform T-Shirt (Size: {selectedOrder.size})</li>
                      <li className="flex items-center gap-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 p-3 rounded-xl"><PackageCheck size={18} className="text-blue-500"/> Fixvo Professional Carry Bag</li>
                      <li className="flex items-center gap-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 p-3 rounded-xl"><PackageCheck size={18} className="text-blue-500"/> Provider ID Card & Lanyard</li>
                    </ul>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={closeModal} className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors">Close</button>
                  </div>
                </div>
              )}

              {/* === UPDATE DELIVERY MODAL === */}
              {activeModal === 'delivery' && selectedOrder && (
                <div className="p-8 pb-12">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800">Update Shipping</h3>
                      <p className="text-sm font-bold text-slate-400 mt-1">Order: {selectedOrder.orderId || selectedOrder.id}</p>
                    </div>
                    <button onClick={closeModal} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Order Status</label>
                      <select value={selectedOrder.status} onChange={(e) => setSelectedOrder({...selectedOrder, status: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Courier Partner</label>
                        <input type="text" value={selectedOrder.courier || ''} onChange={(e) => setSelectedOrder({...selectedOrder, courier: e.target.value})} placeholder="e.g. Delhivery" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tracking ID</label>
                        <input type="text" value={selectedOrder.trackingId || ''} onChange={(e) => setSelectedOrder({...selectedOrder, trackingId: e.target.value})} placeholder="Tracking Number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 outline-none transition-all" />
                      </div>
                    </div>

                    <div className="pt-6 flex justify-end gap-3">
                      <button onClick={closeModal} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                      <button onClick={handleUpdateShipping} className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/30">
                        <Save size={16} /> Save Updates
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* === INVOICE MODAL === */}
              {activeModal === 'invoice' && selectedOrder && (
                <div className="p-8 pb-12">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-slate-800">Invoice Preview</h3>
                    <button onClick={closeModal} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  {/* Dummy Invoice Document UI */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 mb-8">
                    <div className="flex justify-between items-start mb-12 border-b border-slate-200 pb-8">
                      <div>
                        <h2 className="text-2xl font-black text-blue-600 tracking-tight">BHARATCLAP</h2>
                        <p className="text-xs font-bold text-slate-500 mt-1">Provider Onboarding Invoice</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-800">INVOICE #INV-{(selectedOrder.orderId || selectedOrder.id).replace('KITORDER', '')}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">Date: {selectedOrder.date ? new Date(selectedOrder.date).toLocaleDateString() : ''}</p>
                      </div>
                    </div>

                    <div className="flex justify-between mb-12">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Billed To</p>
                        <p className="text-sm font-bold text-slate-800">{selectedOrder.providerName || selectedOrder.provider}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{selectedOrder.address}</p>
                      </div>
                    </div>

                    <table className="w-full text-left mb-8">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-3 text-xs font-bold text-slate-500 uppercase">Description</th>
                          <th className="py-3 text-xs font-bold text-slate-500 uppercase text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="py-4 text-sm font-bold text-slate-800">Fixvo Professional Starter Kit<br/><span className="text-xs font-medium text-slate-500">Service: {selectedOrder.service} | Size: {selectedOrder.size}</span></td>
                          <td className="py-4 text-sm font-bold text-slate-800 text-right">₹{selectedOrder.amount > 0 ? 699 : 0}</td>
                        </tr>
                        {selectedOrder.amount > 0 && (
                          <>
                            <tr>
                              <td className="py-4 text-sm font-medium text-slate-600">GST (18%)</td>
                              <td className="py-4 text-sm font-medium text-slate-600 text-right">₹126</td>
                            </tr>
                            <tr>
                              <td className="py-4 text-sm font-medium text-slate-600">Shipping & Convenience</td>
                              <td className="py-4 text-sm font-medium text-slate-600 text-right">₹70</td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>

                    <div className="flex justify-end border-t border-slate-800 pt-4">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Paid</p>
                        <p className="text-2xl font-black text-slate-900">₹{selectedOrder.amount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={closeModal} className="px-6 py-2.5 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">Close</button>
                    <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30">
                      <Download size={16} /> Download PDF
                    </button>
                  </div>
                </div>
              )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
