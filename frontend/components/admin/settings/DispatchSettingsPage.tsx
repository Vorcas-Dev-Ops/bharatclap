"use client";

import React, { useState, useEffect } from 'react';
import {
  Sliders, Save, RefreshCw, CheckCircle2, ShieldAlert, Navigation, Star,
  Sparkles, Scale, Clock, Zap, Target
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

const DispatchSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState({
    distanceWeight: 40,
    ratingWeight: 20,
    priorityPackageWeight: 15,
    loadBalancingWeight: 15,
    recencyWeight: 10,
    maxConcurrentJobs: 3,
    maxJobsPerDay: 20,
    responseTimeoutSeconds: 600,
    dispatchRadiusMeters: 10000,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchDispatchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/providers/admin/dispatch-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setSettings({
          distanceWeight: res.data.distanceWeight ?? 40,
          ratingWeight: res.data.ratingWeight ?? 20,
          priorityPackageWeight: res.data.priorityPackageWeight ?? 15,
          loadBalancingWeight: res.data.loadBalancingWeight ?? 15,
          recencyWeight: res.data.recencyWeight ?? 10,
          maxConcurrentJobs: res.data.maxConcurrentJobs ?? 3,
          maxJobsPerDay: res.data.maxJobsPerDay ?? 20,
          responseTimeoutSeconds: res.data.responseTimeoutSeconds ?? 600,
          dispatchRadiusMeters: res.data.dispatchRadiusMeters ?? 10000,
        });
      }
    } catch (err) {
      console.error('Failed to load dispatch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/providers/admin/dispatch-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage({ type: 'success', text: 'Dispatch & Load Balancing settings updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to save dispatch settings' });
    } finally {
      setSaving(false);
    }
  };

  const totalWeight = settings.distanceWeight + settings.ratingWeight + settings.priorityPackageWeight + settings.loadBalancingWeight + settings.recencyWeight;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 max-w-5xl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-md">
              <Sliders size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dispatch & Load<span className="text-blue-600"> Balancing Rules</span></h1>
              <p className="text-xs text-gray-500 font-medium">Fine-tune dynamic weighted dispatch scoring, load balancing weights, and concurrency limits.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wider self-start md:self-auto"
        >
          {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />}
          Save Dispatch Settings
        </button>
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
        <div className="p-12 text-center text-gray-400 font-medium bg-white rounded-3xl border border-gray-100">Loading dispatch configuration...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Dispatch Scoring Weights Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <Scale className="text-indigo-600" size={20} />
                  <span>Weighted Dispatch Score Formula</span>
                </h2>
                <p className="text-xs text-gray-500 font-medium">Calculates candidate match score to distribute customer jobs fairly while rewarding priority packages.</p>
              </div>

              <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                totalWeight === 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                Total Weight: {totalWeight}%
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Distance Weight Slider */}
              <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Navigation size={14} className="text-blue-500" /> Proximity Distance Weight
                  </span>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{settings.distanceWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.distanceWeight}
                  onChange={e => setSettings({ ...settings, distanceWeight: Number(e.target.value) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 font-medium">Higher weight prioritizes experts closest to customer location.</p>
              </div>

              {/* Rating Weight Slider */}
              <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Star size={14} className="text-amber-500 fill-amber-500" /> Rating Weight
                  </span>
                  <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{settings.ratingWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.ratingWeight}
                  onChange={e => setSettings({ ...settings, ratingWeight: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 font-medium">Rewards top customer rated providers.</p>
              </div>

              {/* Priority Package Boost Slider */}
              <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-500" /> Priority Package Boost Weight
                  </span>
                  <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">{settings.priorityPackageWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.priorityPackageWeight}
                  onChange={e => setSettings({ ...settings, priorityPackageWeight: Number(e.target.value) })}
                  className="w-full accent-purple-600 cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 font-medium">Gives advantage to providers with active Priority Lead Packages.</p>
              </div>

              {/* Load Balancing Workload Slider */}
              <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Scale size={14} className="text-emerald-500" /> Load Balancing (Least Jobs Today)
                  </span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{settings.loadBalancingWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.loadBalancingWeight}
                  onChange={e => setSettings({ ...settings, loadBalancingWeight: Number(e.target.value) })}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 font-medium">Prevents provider overloading by prioritizing experts with fewer jobs today.</p>
              </div>

              {/* Recency Weight Slider */}
              <div className="p-4 bg-gray-50/70 rounded-2xl border border-gray-100 space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" /> Last Job Recency Weight
                  </span>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{settings.recencyWeight}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.recencyWeight}
                  onChange={e => setSettings({ ...settings, recencyWeight: Number(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[10px] text-gray-400 font-medium">Increases match score for experts who have waited longer since their last job assignment.</p>
              </div>
            </div>
          </div>

          {/* Operational Dispatch Limits & Radius Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Target className="text-blue-600" size={20} />
                <span>Operational Concurrency & Timeout Rules</span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">Set hard operational thresholds for provider workloads and dispatch timeouts.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Max Concurrent Active Jobs</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentJobs}
                  onChange={e => setSettings({ ...settings, maxConcurrentJobs: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Max Jobs Per Day Per Provider</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.maxJobsPerDay}
                  onChange={e => setSettings({ ...settings, maxJobsPerDay: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Response Timeout (Seconds)</label>
                <input
                  type="number"
                  min="30"
                  max="3600"
                  value={settings.responseTimeoutSeconds}
                  onChange={e => setSettings({ ...settings, responseTimeoutSeconds: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Dispatch Radius (Meters)</label>
                <input
                  type="number"
                  min="500"
                  max="100000"
                  value={settings.dispatchRadiusMeters}
                  onChange={e => setSettings({ ...settings, dispatchRadiusMeters: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wider"
            >
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />}
              Save Dispatch Settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default DispatchSettingsPage;
