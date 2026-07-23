"use client";

import React, { useState, useEffect } from 'react';
import { Tag, Save, Layers, ShieldCheck, Percent, RefreshCcw, Layers3, UserCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

export default function AdminCommissionsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [bulkRate, setBulkRate] = useState<number>(20);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCommissionRules();
  }, []);

  const fetchCommissionRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const [commRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/commissions`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/categories`).catch(() => ({ data: [] })),
      ]);

      const catList = Array.isArray(catRes.data) ? catRes.data : [];
      setCategories(catList);

      const commList = Array.isArray(commRes.data) ? commRes.data : [];
      setCommissions(commList);
    } catch (err: any) {
      console.warn('Error fetching commission rules:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      await axios.put(
        `${API_URL}/commissions/bulk-update`,
        { rate: bulkRate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage(`Successfully updated global category commission rate to ${bulkRate}%`);
      await fetchCommissionRules();
    } catch (err: any) {
      alert('Bulk update failed: ' + (err?.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Hierarchical <span className="text-blue-600">Commission Rules</span>
          </h1>
          <p className="text-xs font-bold text-gray-500 mt-1">
            Configure category, service, membership, and provider commission override rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCommissionRules}
            className="p-3 bg-white border border-gray-100 hover:border-gray-200 rounded-2xl text-gray-600 shadow-xs transition-all"
            title="Refresh Rules"
          >
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-green-50 text-green-700 border border-green-200 rounded-2xl text-xs font-bold flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-green-800 text-xs">Dismiss</button>
        </div>
      )}

      {/* Global Bulk Override Card */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Percent size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Global Category Bulk Override</h3>
            <p className="text-xs text-gray-500 font-medium">Apply a uniform commission rate across all service categories</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
          <div className="relative flex-1 w-full">
            <input
              type="number"
              min="0"
              max="100"
              value={bulkRate}
              onChange={e => setBulkRate(Number(e.target.value))}
              className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-300"
              placeholder="e.g. 20"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">%</span>
          </div>
          <button
            onClick={handleBulkUpdate}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Apply Bulk Commission'}
          </button>
        </div>
      </div>

      {/* Category Rate Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-blue-600" />
            <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Active Category Rates</h3>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{categories.length} Categories</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/30 border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="px-6 py-4">Category Name</th>
                <th className="px-6 py-4">Commission Rate (%)</th>
                <th className="px-6 py-4">GST on Commission</th>
                <th className="px-6 py-4">Hierarchy Level</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {categories.map((cat) => {
                const rule = commissions.find((c: any) => c.category_name === cat.category_name);
                const rate = rule ? rule.rate : bulkRate;

                return (
                  <tr key={cat._id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-6 py-4 font-black text-gray-900">{cat.category_name}</td>
                    <td className="px-6 py-4 font-black text-blue-600">{rate}%</td>
                    <td className="px-6 py-4 text-gray-500 font-medium">18% GST</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[9px] font-black uppercase tracking-wider">
                        Category Level
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-xl text-[9px] font-black uppercase tracking-wider">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
