"use client";

import React, { useState, useEffect } from 'react';
import {
  Sliders, Save, CheckCircle2, ShieldAlert, Navigation, Star,
  Sparkles, Scale, Clock, Target, Edit3, X, Lock
} from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';

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

  const [savedSettings, setSavedSettings] = useState(settings);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchDispatchSettings = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/admin/dispatch-settings`);
      if (res && res.ok) {
        const data = await res.json();
        const loaded = {
          distanceWeight: data.distanceWeight ?? 40,
          ratingWeight: data.ratingWeight ?? 20,
          priorityPackageWeight: data.priorityPackageWeight ?? 15,
          loadBalancingWeight: data.loadBalancingWeight ?? 15,
          recencyWeight: data.recencyWeight ?? 10,
          maxConcurrentJobs: data.maxConcurrentJobs ?? 3,
          maxJobsPerDay: data.maxJobsPerDay ?? 20,
          responseTimeoutSeconds: data.responseTimeoutSeconds ?? 600,
          dispatchRadiusMeters: data.dispatchRadiusMeters ?? 10000,
        };
        setSettings(loaded);
        setSavedSettings(loaded);
      }
    } catch (err: any) {
      console.warn('[DispatchSettingsPage] Notice loading settings:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await authFetch(`${API_URL}/providers/admin/dispatch-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to save dispatch settings');
      }
      setSavedSettings(settings);
      setIsEditing(false);
      setMessage({ type: 'success', text: 'Dispatch & Load Balancing settings updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save dispatch settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(savedSettings);
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const totalWeight = settings.distanceWeight + settings.ratingWeight + settings.priorityPackageWeight + settings.loadBalancingWeight + settings.recencyWeight;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-md">
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Dispatch & Load<span className="text-blue-600"> Balancing Rules</span></h1>
                <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isEditing ? 'bg-blue-100 text-blue-700 border border-blue-200 animate-pulse' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {isEditing ? <Edit3 size={12} /> : <Lock size={12} />}
                  {isEditing ? 'Editing Mode' : 'Read-Only'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Fine-tune dynamic weighted dispatch scoring, load balancing weights, and concurrency limits.</p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        {!isEditing ? (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setMessage({ type: '', text: '' });
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-md hover:shadow-blue-500/20 transition-all flex items-center gap-2 uppercase tracking-wider self-start md:self-auto cursor-pointer"
          >
            <Edit3 size={16} />
            Edit Settings
          </button>
        ) : (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
            >
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        )}
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
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${isEditing ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/40 border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Navigation size={14} className="text-blue-500" /> Proximity Distance Weight
                  </span>
                  <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{settings.distanceWeight}%</span>
                </div>
                <div className="relative w-full h-3 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-gray-200/80 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{ width: `${Math.min(100, Math.max(0, settings.distanceWeight))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isEditing}
                    value={settings.distanceWeight}
                    onChange={e => setSettings({ ...settings, distanceWeight: Number(e.target.value) })}
                    className={`relative w-full h-3 appearance-none bg-transparent focus:outline-none z-10 ${
                      !isEditing ? 'cursor-not-allowed opacity-0' : 'cursor-pointer accent-blue-600'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Higher weight prioritizes experts closest to customer location.</p>
              </div>

              {/* Rating Weight Slider */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${isEditing ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/40 border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Star size={14} className="text-amber-500 fill-amber-500" /> Rating Weight
                  </span>
                  <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">{settings.ratingWeight}%</span>
                </div>
                <div className="relative w-full h-3 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-gray-200/80 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-amber-400 to-amber-500"
                      style={{ width: `${Math.min(100, Math.max(0, settings.ratingWeight))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isEditing}
                    value={settings.ratingWeight}
                    onChange={e => setSettings({ ...settings, ratingWeight: Number(e.target.value) })}
                    className={`relative w-full h-3 appearance-none bg-transparent focus:outline-none z-10 ${
                      !isEditing ? 'cursor-not-allowed opacity-0' : 'cursor-pointer accent-amber-500'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Rewards top customer rated providers.</p>
              </div>

              {/* Priority Package Boost Slider */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${isEditing ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/40 border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-500" /> Priority Package Boost Weight
                  </span>
                  <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">{settings.priorityPackageWeight}%</span>
                </div>
                <div className="relative w-full h-3 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-gray-200/80 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-purple-500 to-purple-600"
                      style={{ width: `${Math.min(100, Math.max(0, settings.priorityPackageWeight))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isEditing}
                    value={settings.priorityPackageWeight}
                    onChange={e => setSettings({ ...settings, priorityPackageWeight: Number(e.target.value) })}
                    className={`relative w-full h-3 appearance-none bg-transparent focus:outline-none z-10 ${
                      !isEditing ? 'cursor-not-allowed opacity-0' : 'cursor-pointer accent-purple-600'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Gives advantage to providers with active Priority Lead Packages.</p>
              </div>

              {/* Load Balancing Workload Slider */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 ${isEditing ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/40 border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Scale size={14} className="text-emerald-500" /> Load Balancing (Least Jobs Today)
                  </span>
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{settings.loadBalancingWeight}%</span>
                </div>
                <div className="relative w-full h-3 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-gray-200/80 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-emerald-500 to-emerald-600"
                      style={{ width: `${Math.min(100, Math.max(0, settings.loadBalancingWeight))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isEditing}
                    value={settings.loadBalancingWeight}
                    onChange={e => setSettings({ ...settings, loadBalancingWeight: Number(e.target.value) })}
                    className={`relative w-full h-3 appearance-none bg-transparent focus:outline-none z-10 ${
                      !isEditing ? 'cursor-not-allowed opacity-0' : 'cursor-pointer accent-emerald-600'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-gray-400 font-medium">Prevents provider overloading by prioritizing experts with fewer jobs today.</p>
              </div>

              {/* Recency Weight Slider */}
              <div className={`p-4 rounded-2xl border transition-all space-y-3 md:col-span-2 ${isEditing ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/40 border-gray-100'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-900 flex items-center gap-2">
                    <Clock size={14} className="text-indigo-500" /> Last Job Recency Weight
                  </span>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{settings.recencyWeight}%</span>
                </div>
                <div className="relative w-full h-3 flex items-center">
                  <div className="absolute inset-x-0 h-2 bg-gray-200/80 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-indigo-500 to-indigo-600"
                      style={{ width: `${Math.min(100, Math.max(0, settings.recencyWeight))}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={!isEditing}
                    value={settings.recencyWeight}
                    onChange={e => setSettings({ ...settings, recencyWeight: Number(e.target.value) })}
                    className={`relative w-full h-3 appearance-none bg-transparent focus:outline-none z-10 ${
                      !isEditing ? 'cursor-not-allowed opacity-0' : 'cursor-pointer accent-indigo-600'
                    }`}
                  />
                </div>
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
                  disabled={!isEditing}
                  value={settings.maxConcurrentJobs}
                  onChange={e => setSettings({ ...settings, maxConcurrentJobs: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white disabled:bg-gray-100/80 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Max Jobs Per Day Per Provider</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  disabled={!isEditing}
                  value={settings.maxJobsPerDay}
                  onChange={e => setSettings({ ...settings, maxJobsPerDay: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white disabled:bg-gray-100/80 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Response Timeout (Seconds)</label>
                <input
                  type="number"
                  min="30"
                  max="3600"
                  disabled={!isEditing}
                  value={settings.responseTimeoutSeconds}
                  onChange={e => setSettings({ ...settings, responseTimeoutSeconds: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white disabled:bg-gray-100/80 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Dispatch Radius (Meters)</label>
                <input
                  type="number"
                  min="500"
                  max="100000"
                  disabled={!isEditing}
                  value={settings.dispatchRadiusMeters}
                  onChange={e => setSettings({ ...settings, dispatchRadiusMeters: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 focus:bg-white disabled:bg-gray-100/80 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed transition-all"
                  required
                />
              </div>
            </div>
          </div>

          {/* Bottom Control Bar */}
          {isEditing && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-md hover:shadow-emerald-500/20 transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {saving ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={16} />}
                Save Dispatch Settings
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

export default DispatchSettingsPage;

