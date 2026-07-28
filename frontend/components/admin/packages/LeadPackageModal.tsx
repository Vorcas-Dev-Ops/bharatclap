"use client";

import React, { useState, useEffect } from 'react';
import { X, Gift, Check, ShieldAlert, Sparkles, Award } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface LeadPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  packageData?: any | null;
}

const LeadPackageModal: React.FC<LeadPackageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  packageData,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    price: 499,
    leads: 50,
    bonusLeads: 10,
    validityDays: 30,
    hasPriorityDispatch: false,
    hasLeadExpiry: true,
    badgeText: '',
    description: '',
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (packageData) {
      setFormData({
        name: packageData.name || '',
        price: packageData.price || 0,
        leads: packageData.leads || 0,
        bonusLeads: packageData.bonusLeads || 0,
        validityDays: packageData.validityDays || 30,
        hasPriorityDispatch: !!packageData.hasPriorityDispatch,
        hasLeadExpiry: packageData.hasLeadExpiry !== false,
        badgeText: packageData.badgeText || '',
        description: packageData.description || '',
        isActive: packageData.isActive !== false,
      });
    } else {
      setFormData({
        name: '',
        price: 499,
        leads: 50,
        bonusLeads: 10,
        validityDays: 30,
        hasPriorityDispatch: false,
        hasLeadExpiry: true,
        badgeText: '',
        description: '',
        isActive: true,
      });
    }
  }, [packageData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Package name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      if (packageData?._id) {
        await axios.put(`${API_URL}/providers/admin/lead-packages/${packageData._id}`, formData, { headers });
      } else {
        await axios.post(`${API_URL}/providers/admin/lead-packages`, formData, { headers });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to save lead package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 overflow-hidden relative">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md">
              <Gift size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {packageData ? 'Edit Lead Package' : 'Create New Lead Package'}
              </h2>
              <p className="text-xs text-gray-500 font-medium">Configure price, lead limits, bonus leads, and priority dispatch boost.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-2">
            <ShieldAlert size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Package Name</label>
              <input
                type="text"
                placeholder="e.g. Starter, Gold, Festival Special"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Price (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Base Leads</label>
              <input
                type="number"
                min="1"
                value={formData.leads}
                onChange={e => setFormData({ ...formData, leads: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Bonus Leads</label>
              <input
                type="number"
                min="0"
                value={formData.bonusLeads}
                onChange={e => setFormData({ ...formData, bonusLeads: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Validity (Days)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 30, 60, 90"
                value={formData.validityDays}
                onChange={e => setFormData({ ...formData, validityDays: Number(e.target.value) })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Badge Text (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 10 Bonus, Best Value"
                value={formData.badgeText}
                onChange={e => setFormData({ ...formData, badgeText: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-600 mb-1">Package Description</label>
            <textarea
              rows={2}
              placeholder="Describe the package benefits for service providers..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Toggle Switches */}
          <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs font-black text-gray-900">Priority Dispatch Ranking Boost</p>
                  <p className="text-[10px] text-gray-500 font-medium">Gives purchasing providers higher score in dispatch matching.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={formData.hasPriorityDispatch}
                onChange={e => setFormData({ ...formData, hasPriorityDispatch: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-indigo-100/60">
              <div>
                <p className="text-xs font-black text-gray-900">Published / Active Status</p>
                <p className="text-[10px] text-gray-500 font-medium">Show package in provider shop for purchase.</p>
              </div>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Check size={16} />
              )}
              {packageData ? 'Save Changes' : 'Create Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeadPackageModal;
