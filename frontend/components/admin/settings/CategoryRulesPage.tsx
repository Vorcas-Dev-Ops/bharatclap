"use client";

import React, { useState, useEffect } from 'react';
import { Layers, Save, RefreshCcw, CheckCircle2, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

const CategoryRulesPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchRules = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/providers/admin/category-rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRules(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load category dispatch rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveRule = async (rule: any) => {
    setSavingId(rule._id || rule.categoryName);
    setMessage({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/providers/admin/category-rules`, rule, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: `Rules for "${rule.categoryName}" updated successfully!` });
      fetchRules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to save rule' });
    } finally {
      setSavingId(null);
    }
  };

  const handleFieldChange = (index: number, field: string, value: any) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl text-white shadow-md">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Category Dispatch<span className="text-purple-600"> Rules</span></h1>
              <p className="text-xs text-gray-500 font-medium">Configure service-specific daily job limits, concurrent job allowances, and emergency override rules.</p>
            </div>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">Loading category rules...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rules.map((rule, idx) => (
            <div key={rule._id || idx} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
              <div className="flex-1">
                <h3 className="text-base font-black text-gray-900 tracking-tight">{rule.categoryName}</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Customize daily throughput caps for {rule.categoryName}.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center flex-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Max Jobs / Day</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={rule.maxJobsPerDay || 15}
                    onChange={e => handleFieldChange(idx, 'maxJobsPerDay', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Max Concurrent Jobs</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rule.maxConcurrentJobs || 3}
                    onChange={e => handleFieldChange(idx, 'maxConcurrentJobs', Number(e.target.value))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 sm:pt-0">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500">Emergency Priority</span>
                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <Zap size={10} /> {rule.isEmergencyEnabled !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveRule(rule)}
                    disabled={savingId === (rule._id || rule.categoryName)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider ml-auto"
                  >
                    {savingId === (rule._id || rule.categoryName) ? <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> : <Save size={14} />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryRulesPage;
