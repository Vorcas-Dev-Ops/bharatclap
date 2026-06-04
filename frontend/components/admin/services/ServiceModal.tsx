"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers, Save, Tag, Activity, Palette, DollarSign, Clock, ImageIcon } from 'lucide-react';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any | null;
  category: any;
  onSave: (service: any) => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ isOpen, onClose, service, category, onSave }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    service_name: '',
    slug: '',
    base_price: '',
    description: '',
    duration: '',
    images: '', // stored as comma-separated in input
    is_featured: false,
    status: 'active'
  });


  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (service) {
        const imagesValue = service.images || service.image || service.image_url || service.imageUrl || '';
        setFormData({
          service_name: service.service_name || '',
          slug: service.slug || '',
          base_price: String(service.base_price) || '',
          description: service.description || '',
          duration: String(service.duration) || '',
          images: Array.isArray(imagesValue) 
            ? imagesValue.join(', ') 
            : String(imagesValue),
          is_featured: service.is_featured || false,
          status: service.status || 'active'
        });



      } else {
        setFormData({
          service_name: '',
          slug: '',
          base_price: '',
          description: '',
          duration: '',
          images: '',
          is_featured: false,
          status: 'active'
        });

      }
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, service]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      category_id: category._id,
      base_price: Number(formData.base_price),
      duration: Number(formData.duration),
      images: formData.images.split(',').map(s => s.trim()).filter(s => s !== '')
    });

  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          key="service-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal Content */}
        <motion.div
          key="service-content"
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] flex flex-col"

        >
          <div className="px-8 pt-6 pb-4 flex justify-between items-center flex-shrink-0 border-b border-gray-50">

            <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">
                {service ? 'Edit Service' : 'New Service'}
                </h2>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">Categorized in {category.category_name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 custom-scrollbar">

            <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4 relative group">
              <div className="space-y-4 relative z-10">
                {/* Service Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <Tag size={12} className="text-blue-500" /> Service Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Premium AC Deep Clean"
                      value={formData.service_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
                        setFormData({ ...formData, service_name: name, slug: (service && service.slug) ? formData.slug : slug });

                      }}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <Tag size={12} className="text-blue-500" /> Slug
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. premium-ac-deep-clean"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-4">
                    {/* Price */}
                    <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <DollarSign size={12} className="text-blue-500" /> Base Price (₹)
                    </label>
                    <input
                        type="number"
                        required
                        placeholder="499"
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                    </div>

                    {/* Duration */}
                    <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <Clock size={12} className="text-blue-500" /> Duration (Mins)
                    </label>
                    <input
                        type="number"
                        required
                        placeholder="60"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                    <Layers size={12} className="text-blue-500" /> Description
                  </label>
                  <textarea
                    required
                    placeholder="Brief details about the service offering..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <ImageIcon size={12} className="text-blue-500" /> Image URLs (comma separated)
                        </label>
                        <input
                            type="text"
                            placeholder="https://image1.jpg, https://image2.jpg"
                            value={formData.images}
                            onChange={(e) => setFormData({ ...formData, images: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                        />

                        {/* Live Preview Strip */}
                        {formData.images && (
                          <div className="flex gap-2 mt-2 overflow-x-auto pb-2 scrollbar-hide">
                            {formData.images.split(',').map((url, idx) => {
                              const trimmedUrl = url.trim();
                              if (!trimmedUrl.startsWith('http')) return null;
                              return (
                                <div key={idx} className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-50 flex-shrink-0 overflow-hidden shadow-sm">
                                  <img src={trimmedUrl} alt="preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                    </div>



                    {/* Status */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <Activity size={12} className="text-blue-500" /> Status & Features
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="flex-1 px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all appearance-none cursor-pointer"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_featured: !formData.is_featured })}
                            className={`px-4 py-3 rounded-2xl text-[9px] font-black tracking-widest transition-all ${formData.is_featured ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}
                          >
                            FEATURED
                          </button>
                        </div>
                    </div>

                </div>
              </div>
            </div>

            </div>
            
            <div className="flex-shrink-0 px-8 pb-8 pt-4 bg-white border-t border-gray-50 flex gap-3">

              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={14} /> {service ? 'Update Service' : 'Deploy Service'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default ServiceModal;
