"use client";

import React, { useState, useEffect } from 'react';
import Modal from '@/components/admin/common/Modal';
import { Save, X, Briefcase, IndianRupee, MapPin, Check, ChevronDown, Package } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onSuccess: () => void;
}

export default function EditServiceModal({ isOpen, onClose, service, onSuccess }: EditServiceModalProps) {
  const [locations, setLocations] = useState<any[]>([]);
  const [subservices, setSubservices] = useState<any[]>([]);
  
  const [selectedSubserviceIds, setSelectedSubserviceIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    experience: 0,
    price: 0,
    is_available: true,
    is_active: true
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && service) {
      // Initialize with existing service data
      setFormData({
        experience: service.experience || 0,
        price: service.price || 0,
        is_available: service.is_available ?? true,
        is_active: service.is_active ?? true
      });
      setSelectedSubserviceIds(service.subservice_ids?.map((s: any) => typeof s === 'string' ? s : s._id) || []);
      setSelectedLocationIds(service.location_ids || []);
      
      fetchLocations();
      
      // Fetch sub-services for the service's category/service if we can determine it
      // But for now, let's just use what's already populated or fetch if needed
      if (service.subservice_ids?.[0]?.service_id) {
        fetchSubservices(service.subservice_ids[0].service_id);
      }
    }
  }, [isOpen, service]);

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/locations`);
      setLocations(res.data);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const fetchSubservices = async (serviceId: string) => {
    try {
      const res = await axios.get(`${API_URL}/sub-services?service_id=${serviceId}`);
      setSubservices(res.data);
    } catch (error) {
      console.error("Error fetching subservices:", error);
    }
  };

  const toggleSubservice = (id: string) => {
    setSelectedSubserviceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const areas = locations.filter(loc => loc.type === 'area');

  const toggleLocation = (id: string) => {
    setSelectedLocationIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      
      const payload = {
        experience: formData.experience,
        price: formData.price,
        final_price: formData.price, // Assuming no separate discount for now
        location_ids: selectedLocationIds,
        subservice_ids: selectedSubserviceIds,
        is_available: formData.is_available,
        is_active: formData.is_active
      };

      await axios.put(`${API_URL}/provider-services/${service._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error updating service:", error);
      alert(error.response?.data?.message || "Failed to update service");
    } finally {
      setLoading(false);
    }
  };

  if (!service) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit Service: ${service.subservice_ids?.[0]?.subservice_name || 'Service'}`}
      size="lg"
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
            disabled={loading || selectedSubserviceIds.length === 0}
            className="px-6 py-2.5 bg-[#1D2B83] text-white text-sm font-bold rounded-xl hover:bg-[#16236b] transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? "Saving..." : <><Save className="h-4 w-4" /> Save Changes</>}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8 px-1">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-[#1D2B83]" />
              Years of Experience
            </label>
            <input 
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all"
              value={formData.experience}
              onChange={(e) => setFormData({...formData, experience: Number(e.target.value)})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <IndianRupee className="w-3.5 h-3.5 text-[#1D2B83]" />
              Price (₹)
            </label>
            <input 
              type="number"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all"
              value={formData.price}
              onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
            />
          </div>
        </div>

        {/* Sub-Service Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-[#1D2B83]" />
            Manage Sub-Services
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subservices.length > 0 ? (
              subservices.map(sub => (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => toggleSubservice(sub._id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group ${selectedSubserviceIds.includes(sub._id) ? "border-[#1D2B83] bg-[#1D2B83]/5 ring-1 ring-[#1D2B83]" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}
                >
                  <span className={`text-xs font-bold ${selectedSubserviceIds.includes(sub._id) ? "text-[#1D2B83]" : "text-slate-600"}`}>
                    {sub.subservice_name}
                  </span>
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedSubserviceIds.includes(sub._id) ? "bg-[#1D2B83] border-[#1D2B83]" : "bg-white border-slate-200 group-hover:border-slate-300"}`}>
                    {selectedSubserviceIds.includes(sub._id) && <Check size={12} className="text-white stroke-[3px]" />}
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-[10px] font-bold">
                No additional sub-services found for this category
              </div>
            )}
          </div>
        </div>

        {/* Location Selection */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#1D2B83]" />
            Service Areas
          </label>
          
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsLocDropdownOpen(!isLocDropdownOpen)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-all focus:ring-2 focus:ring-[#1D2B83]/20 outline-none"
            >
              <span>{selectedLocationIds.length} areas selected</span>
              <ChevronDown className={`w-4 h-4 transition-all ${isLocDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isLocDropdownOpen && (
              <div className="absolute z-50 mt-2 w-full max-h-48 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl py-2 custom-scrollbar">
                {areas.map(loc => (
                  <button
                    key={loc._id}
                    type="button"
                    onClick={() => toggleLocation(loc._id)}
                    className={`w-full px-4 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 transition-all ${selectedLocationIds.includes(loc._id) ? "text-[#1D2B83] bg-[#1D2B83]/5" : "text-slate-600"}`}
                  >
                    {loc.name}
                    {selectedLocationIds.includes(loc._id) && <Check size={14} className="text-[#1D2B83]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Availability Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div>
            <p className="text-xs font-bold text-slate-900">Service Availability</p>
            <p className="text-[10px] text-slate-500 font-medium">Turn this off to temporarily hide this service from customers.</p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({...formData, is_available: !formData.is_available})}
            className={`w-12 h-6 rounded-full transition-all relative ${formData.is_available ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_available ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

      </form>
    </Modal>
  );
}
