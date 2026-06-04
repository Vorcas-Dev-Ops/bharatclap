"use client";

import React, { useState } from 'react';
import Modal from '@/components/admin/common/Modal';
import { Calendar, Plus, Info } from 'lucide-react';

interface AddBlockedDateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddBlockedDateModal({ isOpen, onClose }: AddBlockedDateModalProps) {
  const [formData, setFormData] = useState({
    date: '',
    reason: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Blocked Date:", formData);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Block Specific Date"
      size="md"
      footer={
        <>
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Block Date
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700 font-medium leading-relaxed">
            Blocked dates will prevent customers from booking any slots on that specific day. Perfect for holidays or personal breaks.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Date</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="date"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Reason (Optional)</label>
          <input 
            type="text"
            placeholder="e.g. Family Function, Vacation"
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none"
            value={formData.reason}
            onChange={(e) => setFormData({...formData, reason: e.target.value})}
          />
        </div>
      </form>
    </Modal>
  );
}
