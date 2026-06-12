"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Plus, Edit2, Trash2, Clock, ToggleLeft, ToggleRight,
  X, Save, AlertTriangle, ChevronRight, Tag, Zap
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface TimeSlotRule {
  _id?: string;
  categoryId: string;
  categoryName: string;
  ruleName: string;
  startTime: string;
  endTime: string;
  extraCharge: number;
  isActive: boolean;
}

interface Category {
  _id: string;
  category_name: string;
}

const emptyRule: TimeSlotRule = {
  categoryId: '',
  categoryName: '',
  ruleName: '',
  startTime: '',
  endTime: '',
  extraCharge: 0,
  isActive: true,
};

const TIME_LABEL_COLORS: Record<string, string> = {
  'Early Morning': 'bg-indigo-100 text-indigo-700',
  'Late Night': 'bg-purple-100 text-purple-700',
  'Peak Hour': 'bg-orange-100 text-orange-700',
  'Off-Peak': 'bg-green-100 text-green-700',
  'Weekend': 'bg-pink-100 text-pink-700',
};

export default function TimeslotManager() {
  const [rules, setRules] = useState<TimeSlotRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TimeSlotRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TimeSlotRule>(emptyRule);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);

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
    setForm({ ...rule });
    setIsModalOpen(true);
  };

  const openDelete = (id: string) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const handleCategoryChange = (categoryId: string) => {
    const cat = categories.find(c => c._id === categoryId);
    setForm(f => ({ ...f, categoryId, categoryName: cat?.category_name || '' }));
  };

  const handleSave = async () => {
    if (!form.categoryId || !form.ruleName || !form.startTime || !form.endTime) return;
    setIsSaving(true);
    try {
      if (editingRule?._id) {
        await axios.put(`${API_URL}/timeslot-rules/${editingRule._id}`, form, { headers });
      } else {
        await axios.post(`${API_URL}/timeslot-rules`, form, { headers });
      }
      await fetchRules();
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`${API_URL}/timeslot-rules/${deletingId}`, { headers });
      await fetchRules();
      setIsDeleteOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggle = async (rule: TimeSlotRule) => {
    try {
      await axios.patch(`${API_URL}/timeslot-rules/${rule._id}/toggle`, {}, { headers });
      await fetchRules();
    } catch (e) {
      console.error(e);
    }
  };

  // Group rules by category
  const uniqueCategories = Array.from(new Set(rules.map(r => r.categoryId)))
    .map(id => ({ id, name: rules.find(r => r.categoryId === id)?.categoryName || id }));

  const filteredRules = filterCategory === 'all'
    ? rules
    : rules.filter(r => r.categoryId === filterCategory);

  const groupedRules = filteredRules.reduce<Record<string, TimeSlotRule[]>>((acc, rule) => {
    if (!acc[rule.categoryId]) acc[rule.categoryId] = [];
    acc[rule.categoryId].push(rule);
    return acc;
  }, {});

  return (
    <div className="w-full space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Time Slot Pricing Rules</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Configure category-wise surcharges for early morning, late night, and peak hours.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25"
        >
          <Plus size={18} /> Add Rule
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Rules', value: rules.length, icon: Clock, hoverBg: 'hover:bg-blue-50', iconColor: 'text-blue-600', iconBg: 'bg-blue-50/50' },
          { label: 'Active Rules', value: rules.filter(r => r.isActive).length, icon: Zap, hoverBg: 'hover:bg-green-50', iconColor: 'text-green-600', iconBg: 'bg-green-50/50' },
          { label: 'Categories', value: uniqueCategories.length, icon: Tag, hoverBg: 'hover:bg-purple-50', iconColor: 'text-purple-600', iconBg: 'bg-purple-50/50' },
          { label: 'Inactive Rules', value: rules.filter(r => !r.isActive).length, icon: ToggleLeft, hoverBg: 'hover:bg-orange-50', iconColor: 'text-orange-600', iconBg: 'bg-orange-50/50' },
        ].map(({ label, value, icon: Icon, hoverBg, iconColor, iconBg }) => (
          <div key={label} className={`bg-white rounded-xl p-3 border border-slate-100 shadow-sm flex items-center gap-3 transition-colors cursor-default ${hoverBg}`}>
            <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}>
              <Icon size={18} />
            </div>
            <div>
              <p className="text-lg font-black text-slate-900 leading-none">{value}</p>
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Filter Dropdown */}
      {categories.length > 0 && (
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100 w-max">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-2">Filter:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.category_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Rules Table */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
        </div>
      ) : Object.keys(groupedRules).length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
            <Clock size={28} className="text-slate-300" />
          </div>
          <p className="text-base font-bold text-slate-400">No time slot rules configured yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Rule" to create your first pricing rule.</p>
          <button onClick={openAdd} className="mt-6 flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all">
            <Plus size={16} /> Add First Rule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredRules.map((rule) => (
            <motion.div
              key={rule._id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col relative group hover:border-blue-200 hover:shadow-md transition-all"
            >
              {/* Top Actions */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(rule)}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all bg-white shadow-sm border border-slate-100"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => openDelete(rule._id!)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all bg-white shadow-sm border border-slate-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Status Toggle & Rule Name */}
              <div className="flex justify-between items-start mb-4 pr-16">
                 <div>
                    <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg ${TIME_LABEL_COLORS[rule.ruleName] || 'bg-slate-100 text-slate-700'}`}>
                      {rule.ruleName}
                    </span>
                    <p className="text-[11px] font-bold text-slate-400 mt-1.5 flex items-center gap-1 truncate max-w-[150px]">
                      <Tag size={10} className="shrink-0" /> {rule.categoryName}
                    </p>
                 </div>
              </div>

              {/* Times */}
              <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between border border-slate-100">
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">From</p>
                  <p className="text-sm font-bold text-slate-800 font-mono">{rule.startTime}</p>
                </div>
                <div className="w-4 h-px bg-slate-300"></div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">To</p>
                  <p className="text-sm font-bold text-slate-800 font-mono">{rule.endTime}</p>
                </div>
              </div>

              {/* Extra Charge & Toggle */}
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                 <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Surcharge</p>
                   <p className="text-base font-black text-emerald-600">+ ₹{rule.extraCharge}</p>
                 </div>
                 <button onClick={() => handleToggle(rule)} className="flex flex-col items-center gap-0.5 group/btn">
                    {rule.isActive
                      ? <ToggleRight size={26} className="text-green-500 group-hover/btn:text-green-600 transition-colors" />
                      : <ToggleLeft size={26} className="text-slate-300 group-hover/btn:text-slate-400 transition-colors" />}
                    <span className={`text-[9px] font-black uppercase tracking-widest ${rule.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                      {rule.isActive ? 'Active' : 'Off'}
                    </span>
                  </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">
                      {editingRule ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Configure time-based surcharge</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all">
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                {/* Category */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Service Category *</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Select a category...</option>
                    {categories.map(cat => (
                      <option key={cat._id} value={cat._id}>{cat.category_name}</option>
                    ))}
                  </select>
                </div>

                {/* Rule Name */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Rule Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Early Morning, Late Night, Peak Hour"
                    value={form.ruleName}
                    onChange={(e) => setForm(f => ({ ...f, ruleName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    list="rule-name-suggestions"
                  />
                  <datalist id="rule-name-suggestions">
                    <option value="Early Morning" />
                    <option value="Late Night" />
                    <option value="Peak Hour" />
                    <option value="Off-Peak" />
                    <option value="Weekend" />
                  </datalist>
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Start Time *</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">End Time *</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Extra Charge */}
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Extra Charge (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-sm font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={form.extraCharge === 0 ? '' : form.extraCharge}
                      onChange={(e) => setForm(f => ({ ...f, extraCharge: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      placeholder="Enter amount"
                      className="w-full px-4 py-3 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Preview */}
                {form.startTime && form.endTime && form.extraCharge > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1">Preview</p>
                    <p className="text-sm font-bold text-slate-700">
                      Bookings between <span className="text-blue-700 font-mono">{form.startTime}</span> – <span className="text-blue-700 font-mono">{form.endTime}</span> will incur an extra charge of <span className="text-emerald-700 font-black">₹{form.extraCharge}</span>.
                    </p>
                  </div>
                )}

                {/* Status Toggle */}
                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Rule Status</p>
                    <p className="text-xs text-slate-500">Enable or disable this rule</p>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))} className="flex items-center gap-2">
                    {form.isActive
                      ? <ToggleRight size={28} className="text-green-500" />
                      : <ToggleLeft size={28} className="text-slate-300" />}
                    <span className={`text-xs font-bold ${form.isActive ? 'text-green-600' : 'text-slate-400'}`}>
                      {form.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !form.categoryId || !form.ruleName || !form.startTime || !form.endTime}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} /> {isSaving ? 'Saving...' : editingRule ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {isDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsDeleteOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center"
            >
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={26} className="text-red-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Delete Rule?</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">This action cannot be undone. The pricing rule will be permanently removed.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsDeleteOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-all">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
