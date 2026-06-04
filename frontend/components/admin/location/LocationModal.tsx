"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, MapPin, Globe2, Activity, Building2, Map as MapIcon } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import dynamic from 'next/dynamic';

const InteractiveMapPicker = dynamic(() => import('./InteractiveMapPicker'), {
  ssr: false,
  loading: () => <div className="w-full h-64 bg-slate-50 animate-pulse rounded-[2rem] flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Initialising Spatial Engine...</div>
});

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationState: any | null;
  onSave: (locationData: any) => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, locationState, onSave }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'area' as 'city' | 'area',
    parent_id: '',
    pincode: '',
    latitude: 12.9716,
    longitude: 77.5946,
    status: 'active' as 'active' | 'inactive'
  });

  const [cities, setCities] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCities = async () => {
    try {
      const resp = await axios.get(`${API_URL}/locations`);
      setCities(resp.data.filter((l: any) => l.type === 'city'));
    } catch (e) {
      console.error('Error fetching cities in modal:', e);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCities();
      document.body.style.overflow = 'hidden';
      if (locationState) {
        setFormData({
          name: locationState.name || '',
          type: locationState.type || 'area',
          parent_id: typeof locationState.parent_id === 'object' ? locationState.parent_id?._id : (locationState.parent_id || ''),
          pincode: locationState.pincode || '',
          latitude: locationState.coordinates?.coordinates[1] || locationState.latitude || 12.9716,
          longitude: locationState.coordinates?.coordinates[0] || locationState.longitude || 77.5946,
          status: locationState.status || 'active'
        });
      } else {
        setFormData({
          name: '',
          type: 'area',
          parent_id: '',
          pincode: '',
          latitude: 12.9716,
          longitude: 77.5946,
          status: 'active'
        });
      }
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, locationState]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 pt-6 pb-4 flex justify-between items-center bg-white border-b border-gray-50">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">
                {locationState ? 'Update Node' : 'Configure Territory'}
              </h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Operational Logistics Interface</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors self-start">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="overflow-y-auto px-8 py-6 custom-scrollbar">
            {/* Tab Selector */}
            <div className="flex p-1 bg-gray-100 rounded-[1.5rem] mb-6">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'city', parent_id: '' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'city' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Building2 size={14} />
                City Hub
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'area' })}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'area' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <MapIcon size={14} />
                Localized Area
              </button>
            </div>

            <form id="locationForm" onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-6 relative group">
                
                {/* Status Toggle (Floating Right) */}
                <div className="absolute top-6 right-6">
                   <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${formData.status === 'active' ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <MapPin size={12} className="text-blue-500" /> {formData.type === 'city' ? 'City Hub Identity' : 'Area Node Name'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={formData.type === 'city' ? "e.g. Bangalore Central" : "e.g. Whitefield Sector 4"}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5 transition-all"
                    />
                  </div>

                  {formData.type === 'area' && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                          <Building2 size={12} className="text-blue-500" /> Parent Operational Hub
                        </label>
                        {cities.length > 0 ? (
                          <select
                            required
                            value={formData.parent_id}
                            onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                            className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none"
                          >
                            <option value="">Select Target Hub</option>
                            {cities.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                        ) : (
                          <div className="px-5 py-4 bg-amber-50 border border-amber-100 border-dashed rounded-2xl text-[10px] font-bold text-amber-700 uppercase tracking-tight flex items-center gap-3">
                            <Activity size={14} className="animate-pulse" />
                            Zero City Hubs Found. Create a Hub First.
                          </div>
                        )}
                      </div>

                      {/* Premium Interactive Picker Map */}
                      {formData.parent_id && (
                        <div className="space-y-1.5 pt-2">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <MapIcon size={12} className="text-blue-500" /> Choose Location via Interactive Map
                          </label>
                          <InteractiveMapPicker
                            latitude={formData.latitude}
                            longitude={formData.longitude}
                            parentCityName={cities.find(c => c._id === formData.parent_id)?.name}
                            onLocationPicked={(data) => {
                              setFormData(prev => ({
                                ...prev,
                                name: data.name,
                                pincode: data.pincode || prev.pincode,
                                latitude: data.latitude,
                                longitude: data.longitude
                              }));
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <Globe2 size={12} className="text-blue-500" /> Strategic Pincode
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 560001"
                      value={formData.pincode}
                      onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Geo Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.latitude}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                        className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Geo Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={formData.longitude}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                        className="w-full px-5 py-4 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-500/5 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all shadow-sm"
            >
              Abort Entry
            </button>
            <button
              form="locationForm"
              type="submit"
              className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Save size={14} /> {locationState ? 'Deploy Changes' : 'Initialize Node'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default LocationModal;
