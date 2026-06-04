"use client";

import React, { useState } from 'react';
import Modal from '@/components/admin/common/Modal';
import { Upload, Plus, Image as ImageIcon, X } from 'lucide-react';

interface UploadPortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadPortfolioModal({ isOpen, onClose }: UploadPortfolioModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("New Portfolio Item:", formData);
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Upload Portfolio Photos"
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
            <Upload className="h-4 w-4" />
            Upload Photo
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Multi-upload Placeholder */}
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Files</label>
          <div className="h-40 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50 flex flex-col items-center justify-center gap-3 group cursor-pointer hover:bg-slate-100/50 transition-all">
            <div className="h-10 w-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-primary transition-all">
              <Upload className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold text-slate-400">Upload multiple photos (Max 5MB each)</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Project Title</label>
            <input 
              type="text"
              placeholder="e.g. Modern Living Room Deep Cleaning"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Project Category</label>
            <select 
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
            >
              <option value="">Select Category</option>
              <option value="cleaning">Home Cleaning</option>
              <option value="repair">Maintenance</option>
              <option value="sanitization">Sanitization</option>
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
