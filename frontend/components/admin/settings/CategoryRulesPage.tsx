"use client";

import React, { useState, useEffect } from 'react';
import { Layers, Save, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

const CategoryRulesPage: React.FC = () => {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/admin/category-rules`);
      if (res && res.ok) {
        const data = await res.json();
        setRules(Array.isArray(data) ? data : []);
      }
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
      const res = await authFetch(`${API_URL}/providers/admin/category-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to save rule');
      }
      setMessage({ type: 'success', text: `Rules for "${rule.categoryName}" updated successfully!` });
      await fetchRules();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save rule' });
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 w-full">
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
            <div key={rule._id || rule.categoryName || idx} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
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

                <div className="flex items-center justify-between pt-4 sm:pt-0 gap-3">
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Emergency Priority</span>
                    <button
                      type="button"
                      onClick={() => handleFieldChange(idx, 'isEmergencyEnabled', !(rule.isEmergencyEnabled !== false))}
                      className={`text-[10px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer border ${
                        rule.isEmergencyEnabled !== false 
                          ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' 
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      <Zap size={10} /> {rule.isEmergencyEnabled !== false ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveRule(rule)}
                    disabled={savingId === (rule._id || rule.categoryName)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider ml-auto cursor-pointer disabled:opacity-50"
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

