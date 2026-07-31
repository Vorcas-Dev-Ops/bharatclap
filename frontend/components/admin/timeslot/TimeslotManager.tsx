"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Clock, ToggleLeft, ToggleRight,
  X, Save, AlertTriangle, ChevronRight, Tag, Zap, Play, ShieldAlert, Sliders, CheckCircle2
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export type PricingType = 'FIXED_SURCHARGE' | 'PERCENTAGE_SURCHARGE' | 'FIXED_DISCOUNT' | 'PERCENTAGE_DISCOUNT';

export interface TimeSlotRule {
  _id?: string;
  categoryId: string;
  categoryName: string;
  ruleName: string;
  pricingType: PricingType;
  startTime: string;
  endTime: string;
  extraCharge: number;
  maxExtraCharge?: number;
  priority: number;
  isStackable: boolean;
  isExclusive: boolean;
  city?: string;
  isActive: boolean;
  version?: number;
}

interface Category {
  _id: string;
  category_name: string;
}

const emptyRule: TimeSlotRule = {
  categoryId: '',
  categoryName: '',
  ruleName: '',
  pricingType: 'FIXED_SURCHARGE',
  startTime: '09:00',
  endTime: '12:00',
  extraCharge: 100,
  maxExtraCharge: 250,
  priority: 50,
  isStackable: true,
  isExclusive: false,
  city: '',
  isActive: true,
};

const PRICING_TYPES: { type: PricingType; label: string; icon: string; desc: string }[] = [
  { type: 'FIXED_SURCHARGE', label: '➕ Fixed Surcharge', icon: '+₹', desc: 'Add a fixed rupee amount e.g. +₹100 Peak' },
  { type: 'PERCENTAGE_SURCHARGE', label: '➕ Percentage Surcharge', icon: '+%', desc: 'Add a percentage e.g. +15% Peak' },
  { type: 'FIXED_DISCOUNT', label: '➖ Fixed Discount', icon: '-₹', desc: 'Subtract a fixed amount e.g. -₹50 Deal' },
  { type: 'PERCENTAGE_DISCOUNT', label: '➖ Percentage Discount', icon: '-%', desc: 'Subtract a percentage e.g. -10% Morning' }
];

const PRIORITY_PRESETS = [
  { label: 'Highest (100)', value: 100 },
  { label: 'High (75)', value: 75 },
  { label: 'Normal (50)', value: 50 },
  { label: 'Low (25)', value: 25 }
];

export default function TimeslotManager() {
  const [rules, setRules] = useState<TimeSlotRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TimeSlotRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TimeSlotRule>(emptyRule);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

  // Live preview base price state
  const [sampleBasePrice, setSampleBasePrice] = useState<number>(1000);

  // Simulator state
  const [simForm, setSimForm] = useState({
    slotTime: '18:30',
    basePrice: 1000,
    categoryId: '',
    city: 'Bangalore'
  });
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('token') || localStorage.getItem('adminToken'))
    : '';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchRules = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/timeslot-rules`, { headers });
      setRules(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`, { headers });
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchCategories();
  }, []);

  const openAdd = () => {
    setEditingRule(null);
    setForm(emptyRule);
    setIsModalOpen(true);
  };

  const openEdit = (rule: TimeSlotRule) => {
    setEditingRule(rule);
    setForm({
      ...rule,
      pricingType: rule.pricingType || 'FIXED_SURCHARGE',
      priority: rule.priority || 50,
      isStackable: rule.isStackable ?? true,
      isExclusive: rule.isExclusive ?? false
    });
    setIsModalOpen(true);
  };

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find(c => c._id === catId);
    setForm(f => ({
      ...f,
      categoryId: catId,
      categoryName: cat ? cat.category_name : ''
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (editingRule?._id) {
        await axios.put(`${API_URL}/timeslot-rules/${editingRule._id}`, form, { headers });
      } else {
        await axios.post(`${API_URL}/timeslot-rules`, form, { headers });
      }
      setIsModalOpen(false);
      fetchRules();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to save rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`${API_URL}/timeslot-rules/${deletingId}`, { headers });
      setIsDeleteOpen(false);
      fetchRules();
    } catch (e: any) {
      alert('Failed to delete rule');
    }
  };

  const handleToggle = async (rule: TimeSlotRule) => {
    try {
      await axios.patch(`${API_URL}/timeslot-rules/${rule._id}/toggle`, {}, { headers });
      fetchRules();
    } catch (e) {
      console.error(e);
    }
  };

  const runSimulation = async () => {
    try {
      setSimLoading(true);
      const res = await axios.post(`${API_URL}/timeslot-rules/admin/simulate`, simForm, { headers });
      setSimResult(res.data);
    } catch (e: any) {
      alert('Simulation failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setSimLoading(false);
    }
  };

  // Live preview calculation helper
  const calculatePreview = () => {
    const val = Number(form.extraCharge) || 0;
    const base = Number(sampleBasePrice) || 1000;
    let delta = 0;

    if (form.pricingType === 'FIXED_SURCHARGE') {
      delta = val;
    } else if (form.pricingType === 'PERCENTAGE_SURCHARGE') {
      delta = (base * val) / 100;
      if (form.maxExtraCharge && delta > form.maxExtraCharge) {
        delta = form.maxExtraCharge;
      }
    } else if (form.pricingType === 'FIXED_DISCOUNT') {
      delta = -val;
    } else if (form.pricingType === 'PERCENTAGE_DISCOUNT') {
      delta = -((base * val) / 100);
      if (form.maxExtraCharge && Math.abs(delta) > form.maxExtraCharge) {
        delta = -form.maxExtraCharge;
      }
    }

    const netBeforeTax = Math.max(0, base + delta);
    const gst = Math.round(netBeforeTax * 0.18);
    const finalTotal = Math.round(netBeforeTax + gst);

    return {
      delta: Math.round(delta),
      netBeforeTax: Math.round(netBeforeTax),
      gst,
      finalTotal
    };
  };

  const preview = calculatePreview();

  const filteredRules = filterCategory === 'all'
    ? rules
    : rules.filter(r => r.categoryId === filterCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-bold text-blue-700 mb-2">
            <Zap size={14} /> Enterprise Pricing Engine v2.0
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Time Slot & Dynamic Pricing Rules
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">
            Configure peak-hour surcharges, percentage deals, stacking priorities, and run live sandbox simulations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm"
          >
            <Play size={14} className="text-blue-600" /> Rule Simulator
          </button>
          <button
            onClick={openAdd}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-blue-600/25"
          >
            <Plus size={16} /> Add Pricing Rule
          </button>
        </div>
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-bold">Loading pricing rules...</div>
      ) : filteredRules.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
          <Clock size={40} className="mx-auto text-slate-300" />
          <h3 className="text-base font-black text-slate-800">No Pricing Rules Configured</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">Create rules for peak evening hours or morning deals to optimize capacity and revenue.</p>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl">Create First Rule</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRules.map(rule => (
            <div key={rule._id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    {rule.categoryName || 'All Categories'}
                  </span>
                  <h3 className="text-base font-black text-slate-900 mt-1">{rule.ruleName}</h3>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${rule.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'}`}
                >
                  {rule.isActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Time Window</p>
                  <p className="text-xs font-black text-slate-800">{rule.startTime} – {rule.endTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Impact</p>
                  <p className={`text-sm font-black ${rule.pricingType?.includes('DISCOUNT') ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {rule.pricingType === 'PERCENTAGE_SURCHARGE' ? `+${rule.extraCharge}%` :
                     rule.pricingType === 'PERCENTAGE_DISCOUNT' ? `-${rule.extraCharge}%` :
                     rule.pricingType === 'FIXED_DISCOUNT' ? `-₹${rule.extraCharge}` : `+₹${rule.extraCharge}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Priority: <strong className="text-slate-800">{rule.priority || 50}</strong></span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(rule)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"><Edit2 size={14} /></button>
                  <button onClick={() => { setDeletingId(rule._id!); setIsDeleteOpen(true); }} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black">{editingRule ? 'Edit Pricing Rule' : 'Create Enterprise Pricing Rule'}</h2>
                  <p className="text-xs text-slate-400">Define dynamic surcharges, percentage rules, priorities & preview pricing</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20} /></button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto">
                {/* 1. General Info */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">1. General Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Service Category *</label>
                      <select value={form.categoryId} onChange={e => handleCategoryChange(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold">
                        <option value="">Select category...</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.category_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Rule Name *</label>
                      <input type="text" value={form.ruleName} onChange={e => setForm(f => ({ ...f, ruleName: e.target.value }))} placeholder="e.g. Peak Evening Charge" className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                    </div>
                  </div>
                </div>

                {/* 2. Pricing Type Selector (Component 1 & 2) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">2. Pricing Rule Type</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {PRICING_TYPES.map(pt => (
                      <button
                        key={pt.type}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, pricingType: pt.type }))}
                        className={`p-3 rounded-2xl border text-left transition-all ${form.pricingType === pt.type ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900">{pt.label}</span>
                          <span className="text-xs font-mono font-bold text-blue-600">{pt.icon}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{pt.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {form.pricingType.includes('PERCENTAGE') ? 'Percentage Value (%) *' : 'Amount (₹) *'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={form.pricingType.includes('PERCENTAGE') ? 100 : 10000}
                        value={form.extraCharge}
                        onChange={e => setForm(f => ({ ...f, extraCharge: Number(e.target.value) }))}
                        className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"
                      />
                    </div>
                    {form.pricingType.includes('PERCENTAGE') && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Maximum Charge Cap (₹)</label>
                        <input
                          type="number"
                          value={form.maxExtraCharge || ''}
                          onChange={e => setForm(f => ({ ...f, maxExtraCharge: Number(e.target.value) }))}
                          placeholder="e.g. 250"
                          className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Time Window & Priority Presets (Component 7) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">3. Window & Priority</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Start Time *</label>
                      <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">End Time *</label>
                      <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="w-full p-2.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Priority Preset</label>
                    <div className="flex gap-2">
                      {PRIORITY_PRESETS.map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, priority: preset.value }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${form.priority === preset.value ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Live Interactive Preview Panel (Component 3) */}
                <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-blue-400">Live Calculation Preview</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">Sample Base: ₹</span>
                      <input
                        type="number"
                        value={sampleBasePrice}
                        onChange={e => setSampleBasePrice(Number(e.target.value))}
                        className="w-16 px-1.5 py-0.5 bg-slate-800 text-white text-xs font-bold rounded"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-800/80 p-2.5 rounded-xl">
                      <span className="block text-[10px] text-slate-400">Base Price</span>
                      <strong className="text-slate-200">₹{sampleBasePrice}</strong>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-xl">
                      <span className="block text-[10px] text-slate-400">Rule Impact</span>
                      <strong className={preview.delta >= 0 ? "text-amber-400" : "text-emerald-400"}>
                        {preview.delta >= 0 ? `+₹${preview.delta}` : `-₹${Math.abs(preview.delta)}`}
                      </strong>
                    </div>
                    <div className="bg-slate-800/80 p-2.5 rounded-xl">
                      <span className="block text-[10px] text-slate-400">GST @ 18%</span>
                      <strong className="text-slate-200">₹{preview.gst}</strong>
                    </div>
                    <div className="bg-blue-600 p-2.5 rounded-xl text-white">
                      <span className="block text-[10px] text-blue-200">Final Total</span>
                      <strong className="text-base font-black">₹{preview.finalTotal}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
                <button onClick={handleSave} disabled={isSaving || !form.ruleName} className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700">
                  {isSaving ? 'Saving...' : editingRule ? 'Update Rule' : 'Save Rule'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rule Simulator Modal (Component 9) */}
      <AnimatePresence>
        {isSimulatorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSimulatorOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl z-10 p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2"><Play className="text-blue-600" size={18} /> Pricing Engine Sandbox Simulator</h3>
                <button onClick={() => setIsSimulatorOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Time Slot</label>
                  <input type="text" value={simForm.slotTime} onChange={e => setSimForm(s => ({ ...s, slotTime: e.target.value }))} placeholder="e.g. 18:30" className="w-full p-2 bg-slate-50 border rounded-xl font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Base Price (₹)</label>
                  <input type="number" value={simForm.basePrice} onChange={e => setSimForm(s => ({ ...s, basePrice: Number(e.target.value) }))} className="w-full p-2 bg-slate-50 border rounded-xl font-bold" />
                </div>
              </div>

              <button onClick={runSimulation} disabled={simLoading} className="w-full py-2.5 bg-blue-600 text-white font-bold text-xs rounded-xl shadow">
                {simLoading ? 'Simulating...' : 'Run Simulation'}
              </button>

              {simResult && (
                <div className="bg-slate-50 p-4 rounded-2xl border space-y-3">
                  <h4 className="text-xs font-black text-slate-900">Simulation Output</h4>
                  <div className="space-y-1 text-xs text-slate-700">
                    <p>Net Surcharge / Discount: <strong className={simResult.evaluation.netSlotSurcharge >= 0 ? "text-amber-600" : "text-emerald-600"}>₹{simResult.evaluation.netSlotSurcharge}</strong></p>
                    <p>Applied Rules Count: <strong>{simResult.evaluation.appliedRules.length}</strong></p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {isDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDeleteOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl p-6 text-center max-w-sm w-full z-10 space-y-4">
              <AlertTriangle size={32} className="mx-auto text-red-500" />
              <h3 className="text-base font-black">Archive Rule?</h3>
              <div className="flex gap-2">
                <button onClick={() => setIsDeleteOpen(false)} className="flex-1 py-2 text-xs font-bold bg-slate-100 rounded-xl">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2 text-xs font-bold bg-red-600 text-white rounded-xl">Archive</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
