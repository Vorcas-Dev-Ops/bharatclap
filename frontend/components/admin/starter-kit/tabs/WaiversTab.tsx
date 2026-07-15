"use client";

import React, { useState, useEffect } from 'react';
import { UserMinus, CheckCircle, Plus, X } from 'lucide-react';
import { message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

export default function WaiversTab() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [waivers, setWaivers] = useState<any[]>([]);
  const [fetchingWaivers, setFetchingWaivers] = useState(true);
  
  // Form States
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [waiverType, setWaiverType] = useState('full');
  const [amount, setAmount] = useState(895);
  const [loading, setLoading] = useState(false);
  
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    fetchWaivers();
    fetchProviders();
  }, []);

  const fetchWaivers = async () => {
    setFetchingWaivers(true);
    try {
      const res = await authFetch(`${API_URL}/waivers`);
      if (res.ok) {
        const data = await res.json();
        setWaivers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingWaivers(false);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await authFetch(`${API_URL}/users?role=provider&limit=1000`);
      if (res.ok) {
        const result = await res.json();
        const userList = Array.isArray(result) ? result : (result.data || []);
        setProviders(userList.filter((u: any) => u.role === 'provider'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGrantWaiver = async () => {
    if (!selectedProviderId) {
      messageApi.error('Please select a provider');
      return;
    }
    if (!reason.trim()) {
      messageApi.error('Please provide a reason for the waiver');
      return;
    }

    setLoading(true);
    const provider = providers.find(p => p._id === selectedProviderId);

    try {
      const res = await authFetch(`${API_URL}/waivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider._id,
          providerName: provider.name,
          waiverType,
          amount: waiverType === 'full' ? 895 : amount,
          reason
        })
      });

      if (res.ok) {
        messageApi.success('Waiver granted successfully');
        setSelectedProviderId('');
        setReason('');
        setWaiverType('full');
        setAmount(895);
        fetchWaivers();
        setIsModalOpen(false);
      } else {
        const data = await res.json();
        messageApi.error(data.message || 'Failed to grant waiver');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {contextHolder}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Granted Payment Waivers</h2>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-purple-600/20"
          >
            <Plus size={16} /> Grant New Waiver
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Provider</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount Waived</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Reason</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetchingWaivers ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 font-bold">Loading...</td></tr>
              ) : waivers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500 font-medium">No waivers granted yet.</td></tr>
              ) : (
                waivers.map((waiver) => (
                  <tr key={waiver._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-800">{new Date(waiver.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{waiver.providerName}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${waiver.waiverType === 'full' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {waiver.waiverType.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-slate-800">₹{waiver.amount}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-[200px] truncate" title={waiver.reason}>{waiver.reason}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${waiver.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {waiver.status === 'active' ? 'Active' : 'Used'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Waiver Modal */}
      <AnimatePresence>
        {isModalOpen && (
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
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="max-h-[85vh] overflow-y-auto white-scrollbar mr-1 pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                <div className="p-8 pb-12">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                      <UserMinus size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800">Grant Payment Waiver</h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Waive starter kit fees for specific providers</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Provider</label>
                    <select 
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    >
                      <option value="">-- Select a Provider --</option>
                      {providers.map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.phone || p.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${waiverType === 'full' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-900">Full Waiver</span>
                        <input type="radio" name="waiverType" checked={waiverType === 'full'} onChange={() => setWaiverType('full')} className="w-4 h-4 text-purple-600 focus:ring-purple-500" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Provider pays ₹0. Platform absorbs full cost.</p>
                    </label>
                    <label className={`flex flex-col p-4 border rounded-xl cursor-pointer transition-all ${waiverType === 'partial' ? 'border-purple-600 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-900">Partial Waiver</span>
                        <input type="radio" name="waiverType" checked={waiverType === 'partial'} onChange={() => setWaiverType('partial')} className="w-4 h-4 text-purple-600 focus:ring-purple-500" />
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Specify a custom discount amount.</p>
                    </label>
                  </div>

                  {waiverType === 'partial' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Waiver Amount (₹)</label>
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Reason for Waiver</label>
                    <textarea 
                      rows={3} 
                      placeholder="e.g. Promotional Onboarding, Top Earner Reward"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                    />
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-sm font-medium text-slate-600">
                      Provider will pay: <span className="font-black text-slate-900 text-lg ml-1">₹{waiverType === 'full' ? 0 : Math.max(0, 895 - amount)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                      <button 
                        onClick={handleGrantWaiver} 
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-600/20 disabled:opacity-70"
                      >
                        <CheckCircle size={18} /> {loading ? 'Granting...' : 'Grant Waiver'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
