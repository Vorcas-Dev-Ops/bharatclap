"use client";

import React, { useState, useEffect, useRef } from 'react';
import Modal from '@/components/admin/common/Modal';
import { Upload, Plus, X, Briefcase, IndianRupee, FileText, Check, Trash2, Camera, MapPin, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProviderServices?: any[];
  existingCatalogServices?: any[];
}

interface DocUpload {
  file?: File;
  preview?: string;
  name: string;
}

export default function AddServiceModal({ isOpen, onClose, existingProviderServices = [], existingCatalogServices = [] }: AddServiceModalProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [subservices, setSubservices] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedSubserviceIds, setSelectedSubserviceIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false);
  
  const [certificates, setCertificates] = useState<DocUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    experience: 0,
    priceRange: '',
  });

  const [loading, setLoading] = useState(false);
  const [providerId, setProviderId] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      fetchLocations();
      fetchProviderProfile();
    } else {
      // Reset form on close
      resetForm();
    }
  }, [isOpen]);

  const fetchProviderProfile = async () => {
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      if (!token) return;

      const res = await axios.get(`${API_URL}/providers/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviderId(res.data._id);
    } catch (error) {
      console.error("Error fetching provider profile:", error);
    }
  };

  const resetForm = () => {
    setSelectedCategoryId("");
    setSelectedServiceId("");
    setSelectedSubserviceIds([]);
    setSelectedLocationIds([]);
    setCertificates([]);
    setFormData({ experience: 0, priceRange: '' });
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`);
      setCategories(res.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get(`${API_URL}/locations`);
      setLocations(res.data);
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
  };

  const fetchServices = async (categoryId: string) => {
    try {
      const res = await axios.get(`${API_URL}/services?category_id=${categoryId}`);
      setServices(res.data);
    } catch (error) {
      console.error("Error fetching services:", error);
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

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedCategoryId(id);
    setSelectedServiceId("");
    setSelectedSubserviceIds([]);
    setServices([]);
    setSubservices([]);
    if (id) fetchServices(id);
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedServiceId(id);
    setSelectedSubserviceIds([]);
    setSubservices([]);
    if (id) fetchSubservices(id);
  };

  const toggleSubservice = (id: string) => {
    setSelectedSubserviceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const areas = locations.filter(loc => loc.type === 'area');

  const getLocationLabel = (loc: any) => {
    const cityName = loc.parent_id?.name;
    return cityName ? `${loc.name} (${cityName})` : loc.name;
  };

  const toggleLocation = (id: string) => {
    setSelectedLocationIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newDocs: DocUpload[] = Array.from(files).map(file => ({
      file,
      name: file.name,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));

    setCertificates(prev => [...prev, ...newDocs]);
  };

  const removeCertificate = (index: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerId) {
      alert("Provider profile not found. Please log in again.");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      
      // Parse price from range (e.g., "₹500 - ₹2000" -> 500)
      const priceStr = formData.priceRange.replace(/[^0-9.-]+/g, "");
      const basePrice = parseFloat(priceStr) || 0;

      const payload = {
        provider_id: providerId,
        experience: formData.experience,
        price: basePrice,
        final_price: basePrice,
        location_ids: selectedLocationIds,
        subservice_ids: selectedSubserviceIds,
        documents: certificates.map(c => ({
          doc_type: "Certificate",
          file_url: c.name, // In a real app, you'd upload the file first and use the resulting URL
          uploaded_at: new Date()
        })),
        status: 'active'
      };

      console.log("Saving Provider Service:", payload);
      
      await axios.post(`${API_URL}/provider-services`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onClose();
      // Optionally trigger a refresh of the services list
      window.location.reload(); 
    } catch (error: any) {
      console.error("Error saving service:", error);
      alert(error.response?.data?.message || "Failed to save service");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Add New Service"
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
            disabled={loading || !selectedServiceId || selectedSubserviceIds.length === 0}
            className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? "Saving..." : <><Plus className="h-4 w-4" /> Add Service</>}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8 px-1">
        
        {/* 1. Category Selection */}
        {(() => {
          // Compute which category IDs the provider already uses
          const usedCategoryIds = new Set<string>();
          existingProviderServices.forEach(ps => {
            const firstSub = ps.subservice_ids?.[0];
            if (firstSub?.service_id) {
              const catSrv = existingCatalogServices.find((s: any) => s._id === firstSub.service_id);
              if (catSrv?.category_id?._id) {
                usedCategoryIds.add(catSrv.category_id._id);
              } else if (catSrv?.category_id && typeof catSrv.category_id === 'string') {
                usedCategoryIds.add(catSrv.category_id);
              }
            }
          });
          const hasMaxCategories = usedCategoryIds.size >= 2;
          const displayedCategories = hasMaxCategories ? categories.filter(cat => usedCategoryIds.has(cat._id)) : categories;
          return (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">1. Select Category</label>
              <select 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none transition-all"
                value={selectedCategoryId}
                onChange={handleCategoryChange}
              >
                <option value="">Select Category</option>
                {displayedCategories.map(cat => (
                  <option key={cat._id} value={cat._id}>
                    {cat.category_name}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}

        {/* 2. Service Selection */}
        <div className={`space-y-2 transition-all duration-300 ${!selectedCategoryId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">2. Select Service</label>
          <select 
            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none transition-all"
            value={selectedServiceId}
            onChange={handleServiceChange}
            disabled={!selectedCategoryId}
          >
            <option value="">Select Service</option>
            {services.map(ser => (
              <option key={ser._id} value={ser._id}>{ser.service_name}</option>
            ))}
          </select>
        </div>

        {/* 3. Sub-Service Selection */}
        <div className={`space-y-3 transition-all duration-300 ${!selectedServiceId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">3. Select Sub-Services</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subservices.length > 0 ? (
              subservices.map(sub => (
                <button
                  key={sub._id}
                  type="button"
                  onClick={() => toggleSubservice(sub._id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left group ${selectedSubserviceIds.includes(sub._id) ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}
                >
                  <span className={`text-xs font-bold ${selectedSubserviceIds.includes(sub._id) ? "text-primary" : "text-slate-600"}`}>
                    {sub.subservice_name}
                  </span>
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedSubserviceIds.includes(sub._id) ? "bg-primary border-primary" : "bg-white border-slate-200 group-hover:border-slate-300"}`}>
                    {selectedSubserviceIds.includes(sub._id) && <Check size={12} className="text-white stroke-[3px]" />}
                  </div>
                </button>
              ))
            ) : (
              <div className="col-span-full py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
                {selectedServiceId ? "No sub-services found" : "Select a service first"}
              </div>
            )}
          </div>
        </div>

        {/* 4. Experience, Price & Certificates (Active only after sub-service selection) */}
        <div className={`space-y-8 transition-all duration-300 ${selectedSubserviceIds.length === 0 ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-primary" />
                Years of Experience
              </label>
              <input 
                type="number"
                placeholder="e.g. 5"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none transition-all"
                value={formData.experience}
                onChange={(e) => setFormData({...formData, experience: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                <IndianRupee className="w-3.5 h-3.5 text-primary" />
                Price Range / Fee
              </label>
              <input 
                type="text"
                placeholder="e.g. ₹500 - ₹2000"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-primary outline-none transition-all"
                value={formData.priceRange}
                onChange={(e) => setFormData({...formData, priceRange: e.target.value})}
              />
            </div>
          </div>

          {/* Location Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              Service Locations
            </label>
            
            {areas.length > 4 ? (
              /* Dropdown Mode */
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsLocDropdownOpen(!isLocDropdownOpen)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-all focus:ring-2 focus:ring-primary/20 outline-none"
                >
                  <span className="truncate text-left">
                    {selectedLocationIds.length > 0 
                      ? `${selectedLocationIds.length} locations selected` 
                      : "Select locations"}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-all ${isLocDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isLocDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto bg-white border border-slate-100 rounded-xl shadow-xl py-2 custom-scrollbar">
                    {areas.map(loc => (
                      <button
                        key={loc._id}
                        type="button"
                        onClick={() => toggleLocation(loc._id)}
                        className={`w-full px-4 py-2 text-left text-xs font-bold flex items-center justify-between hover:bg-slate-50 transition-all ${selectedLocationIds.includes(loc._id) ? "text-primary bg-primary/5" : "text-slate-600"}`}
                      >
                        {getLocationLabel(loc)}
                        {selectedLocationIds.includes(loc._id) && <Check size={14} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Display selected chips below dropdown */}
                {selectedLocationIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {selectedLocationIds.map(id => {
                      const loc = areas.find(l => l._id === id);
                      if (!loc) return null;
                      return (
                        <div key={id} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-bold border border-primary/20">
                          {loc.name}
                          <button type="button" onClick={() => toggleLocation(id)} className="hover:text-primary-dark transition-colors">
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Pills Mode */
              <div className="flex flex-wrap gap-2">
                {areas.length > 0 ? (
                  areas.map(loc => (
                    <button
                      key={loc._id}
                      type="button"
                      onClick={() => toggleLocation(loc._id)}
                      className={`px-4 py-2 rounded-full border text-[11px] font-bold transition-all ${selectedLocationIds.includes(loc._id) ? "bg-primary border-primary text-white shadow-md shadow-primary/20" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}
                    >
                      {getLocationLabel(loc)}
                    </button>
                  ))
                ) : (
                  <div className="text-[10px] font-bold text-slate-400 italic">No areas found</div>
                )}
              </div>
            )}
          </div>

          {/* Certificates Upload */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Experience Certificates
            </label>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {certificates.map((doc, idx) => (
                <div key={idx} className="relative group aspect-square rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden flex flex-col items-center justify-center p-2 text-center">
                  {doc.preview ? (
                    <img src={doc.preview} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  ) : (
                    <FileText className="w-8 h-8 text-slate-300 mb-1" />
                  )}
                  <span className="text-[10px] font-bold text-slate-500 truncate w-full relative z-10">{doc.name}</span>
                  <button 
                    type="button"
                    onClick={() => removeCertificate(idx)}
                    className="absolute top-1 right-1 p-1 bg-white/90 text-rose-500 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-2 group hover:border-primary/50 hover:bg-primary/[0.02] transition-all"
              >
                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-all">
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-primary">Upload</span>
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              multiple 
              accept="image/*,.pdf" 
              className="hidden" 
            />
          </div>
        </div>

      </form>
    </Modal>
  );
}
