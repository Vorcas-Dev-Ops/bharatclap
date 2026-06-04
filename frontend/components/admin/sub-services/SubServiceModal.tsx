"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Save, Tag, Activity, Palette, DollarSign, Clock, ImageIcon } from 'lucide-react';

interface SubServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subService: any | null;
  service: any;
  onSave: (subService: any) => void;
}

const SubServiceModal: React.FC<SubServiceModalProps> = ({ isOpen, onClose, subService, service, onSave }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    subservice_name: '',
    base_price: '',
    description: '',
    duration: '',
    variants: [] as { name: string; price: string; duration: string }[],
    image: '',
    status: 'active'
  });


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (subService) {
        setFormData({
          subservice_name: subService.subservice_name || '',
          base_price: String(subService.base_price) || '',
          description: subService.description || '',
          duration: String(subService.duration) || '',
          variants: (subService.variants || []).map((v: any) => ({
            name: v.name,
            price: String(v.price),
            duration: String(v.duration)
          })),
          image: subService.image || '',
          status: subService.status || 'active'
        });

      } else {
        setFormData({
          subservice_name: '',
          base_price: '',
          description: '',
          duration: '',
          variants: [],
          image: '',
          status: 'active'
        });

      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, subService]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      service_id: service._id,
      base_price: Number(formData.base_price),
      duration: Number(formData.duration),
      variants: formData.variants.map(v => ({
        name: v.name,
        price: Number(v.price),
        duration: Number(v.duration)
      }))
    });

  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          key="subservice-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal Content */}
        <motion.div
          key="subservice-content"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] flex flex-col"

        >
          <div className="px-8 pt-6 pb-4 flex justify-between items-center flex-shrink-0 border-b border-gray-50">

            <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">
                {subService ? 'Edit Sub-Service' : 'New Sub-Service'}
                </h2>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Under {service.service_name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar">

            <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4 relative group">
              <div className="space-y-4 relative z-10">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                    <Tag size={12} className="text-blue-500" /> Sub-Service Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Living Room Deep Clean"
                    value={formData.subservice_name}
                    onChange={(e) => setFormData({ ...formData, subservice_name: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                  />

                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <DollarSign size={12} className="text-blue-500" /> Price (₹)
                    </label>
                    <input
                        type="number"
                        required
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                    </div>
                    <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <Clock size={12} className="text-blue-500" /> Duration (Mins)
                    </label>
                    <input
                        type="number"
                        required
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                    </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                    <Layers size={12} className="text-blue-500" /> Description
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all resize-none"
                  />
                </div>

                {/* Variants Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                      <Palette size={12} className="text-blue-500" /> Service Variants / Packages
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        variants: [...formData.variants, { name: '', price: '', duration: '' }]
                      })}
                      className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                    >
                      + Add Variant
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-2xl border border-gray-50 shadow-sm relative group/variant">
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder="Variant Name (e.g. Basic)"
                            value={v.name}
                            onChange={(e) => {
                              const newVariants = [...formData.variants];
                              newVariants[idx].name = e.target.value;
                              setFormData({ ...formData, variants: newVariants });
                            }}
                            className="w-full px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Price"
                              value={v.price}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[idx].price = e.target.value;
                                setFormData({ ...formData, variants: newVariants });
                              }}
                              className="flex-1 px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                            />
                            <input
                              type="number"
                              placeholder="Mins"
                              value={v.duration}
                              onChange={(e) => {
                                const newVariants = [...formData.variants];
                                newVariants[idx].duration = e.target.value;
                                setFormData({ ...formData, variants: newVariants });
                              }}
                              className="flex-1 px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newVariants = formData.variants.filter((_, i) => i !== idx);
                            setFormData({ ...formData, variants: newVariants });
                          }}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover/variant:opacity-100"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <ImageIcon size={12} className="text-blue-500" /> Image URL
                        </label>
                        <input
                            type="text"
                            value={formData.image}
                            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                        />

                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <Activity size={12} className="text-blue-500" /> Status
                        </label>
                        <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                        >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
              </div>
            </div>
            </div>
            
            <div className="flex-shrink-0 px-8 pb-8 pt-4 bg-white border-t border-gray-100 flex gap-3">

              <button type="button" onClick={onClose} className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-gray-200">Cancel</button>
              <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-200 hover:scale-105 transition-all flex items-center justify-center gap-2">
                <Save size={14} /> {subService ? 'Update' : 'Create'} Sub-Service
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default SubServiceModal;
