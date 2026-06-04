"use client";

import React, { useState, useEffect } from 'react';
import { MapPin, Search, Plus, Filter, RefreshCw, Navigation, Edit2, Trash2 } from 'lucide-react';
import Button from '../common/Button';
import LocationModal from './LocationModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import { ILocation } from '../types';


// --- Integrated Hub Registry ---

import axios from 'axios';
import { API_URL } from '@/config/api';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-50 animate-pulse rounded-[2rem] flex items-center justify-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Initialising Spatial Data...</div>
});

const CityToggleRegistry: React.FC = () => {
  const [locations, setLocations] = useState<ILocation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ILocation | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<ILocation | null>(null);

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [locationToToggle, setLocationToToggle] = useState<ILocation | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const resp = await axios.get(`${API_URL}/locations`);
      setLocations(resp.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      const token = localStorage.getItem('token');
      if (editingLocation) {
        await axios.put(`${API_URL}/locations/${editingLocation._id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/locations`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchLocations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleRequest = (loc: ILocation) => {
    setLocationToToggle(loc);
    setIsStatusModalOpen(true);
  };

  const confirmToggle = async () => {
    if (!locationToToggle) return;
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/locations/${locationToToggle._id}`, {
        status: locationToToggle.status === 'active' ? 'inactive' : 'active'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLocations();
    } catch (e) {
      console.error(e);
    } finally {
      setIsStatusModalOpen(false);
      setLocationToToggle(null);
    }
  };

  const handleDeleteRequest = (loc: ILocation) => {
    setLocationToDelete(loc);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!locationToDelete) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/locations/${locationToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchLocations();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleteModalOpen(false);
      setLocationToDelete(null);
    }
  };

  const filteredAreas = locations.filter(l =>
    l.type === 'area' &&
    l.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const bangaloreHub = locations.find(l =>
    l.name.toLowerCase() === 'bangalore' &&
    l.type === 'city'
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* 1. Compact Heading */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Location<span className="text-blue-600"> Management</span></h1>
      </div>

      {/* 2. Slim Action Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="relative group w-full sm:w-80">
          <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search operational nodes..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-bold text-gray-800 focus:border-blue-200 transition-all outline-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => { setEditingLocation(null); setIsModalOpen(true); }}
          className="w-full sm:w-auto shadow-lg shadow-blue-50 bg-blue-600 text-[9px] py-2.5 rounded-xl px-6 font-black uppercase tracking-widest"
        >
          Add New Node
        </Button>
      </div>

      {/* 3. Strategic SaaS Hub Banner (Precision Designed) */}
      <div className="relative group transition-all duration-500">
        {/* Subtle Ambient Glow */}
        <div className="absolute inset-0 bg-[#2563eb]/5 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative bg-white border border-[#e2e8f0] rounded-[1.5rem] p-6 lg:p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col lg:flex-row items-center gap-6 lg:gap-[24px]">

          {/* Left Section: Content */}
          <div className="flex-1 space-y-4 relative z-10 w-full text-left">
            <div className="space-y-2">
              <span className="inline-block px-3 py-1 bg-[#dbeafe] text-[#2563eb] rounded-full text-[9px] font-black uppercase tracking-wider">
                MARKET LEADER HUB
              </span>
              <h2 className="text-4xl font-black text-[#0f172a] tracking-tighter uppercase leading-none">
                BANGALORE
              </h2>
              <p className="text-[#64748b] font-medium text-[13px] max-w-sm leading-relaxed">
                Exclusive operational theater for premium service delivery.
              </p>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 pt-2">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest leading-none">Active Nodes</p>
                <p className="text-lg font-black text-[#0f172a] leading-none mt-1">
                  {filteredAreas.length} Units
                </p>
              </div>
              <div className="w-px h-8 bg-[#e2e8f0]" />
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest leading-none">System Status</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className={`w-2 h-2 rounded-full ${bangaloreHub?.status === 'active' ? 'bg-[#16a34a]' : 'bg-red-500'} animate-pulse`} />
                  <span className={`text-[11px] font-bold ${bangaloreHub?.status === 'active' ? 'text-[#16a34a]' : 'text-red-500'} uppercase`}>{bangaloreHub?.status === 'active' ? 'Optimized' : 'Halted'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Map Preview */}
          <div className="w-full lg:w-[62%] h-56 lg:h-64 rounded-[20px] bg-[#f8fafc] border border-[#e2e8f0] relative overflow-hidden shadow-lg shadow-black/5 group/map">
            <MapComponent
              locations={locations}
              highlightId={highlightedId}
            />

            {/* Soft Gradient Overlay for Blending */}
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white/10 to-transparent pointer-events-none z-[400] transition-opacity group-hover/map:opacity-50" />

            {/* Status & Sync Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-[400]">
              <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-[#e2e8f0] shadow-xl">
                <p className="text-[10px] font-black text-[#2563eb] uppercase tracking-wider">Spatial Sync Active</p>
              </div>
              <button
                onClick={() => bangaloreHub && handleToggleRequest(bangaloreHub)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${bangaloreHub?.status === 'active' ? 'bg-[#2563eb] text-white hover:bg-blue-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
              >
                {bangaloreHub?.status === 'active' ? 'ACTIVE' : 'OFFLINE'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Enhancement Area Cards */}
      <div className="space-y-3">
        <h3 className="px-1 text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] opacity-80">Operational Area Nodes</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredAreas.map((area) => (
            <motion.div
              layout
              key={area._id}
              onMouseEnter={() => setHighlightedId(area._id)}
              onMouseLeave={() => setHighlightedId(null)}
              className={`bg-white border rounded-[1.8rem] p-4 shadow-sm hover:shadow-lg transition-all duration-400 group relative overflow-hidden flex flex-col h-full ${highlightedId === area._id ? 'border-blue-600 ring-2 ring-blue-50' : 'border-gray-100'}`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3 relative z-10">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${area.status === 'active' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'bg-gray-100 text-gray-400'}`}>
                  <Navigation size={14} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setEditingLocation(area); setIsModalOpen(true); }}
                    className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-blue-600 transition-all"
                    title="Edit Location"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(area)}
                    className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400 hover:text-red-500 transition-all"
                    title="Delete Location"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Main Content */}
              <div className="space-y-0.5 relative z-10 flex-1">
                <h4 className="text-[14px] font-black text-gray-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors truncate">{area.name}</h4>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1 h-1 rounded-full ${area.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{area.status === 'active' ? 'Active' : 'Offline'}</p>
                </div>
              </div>

              {/* Enhanced Metrics */}
              <div className="mt-4 space-y-2.5 relative z-10">
                <div className="flex justify-between items-end border-b border-gray-50 pb-2">
                  <div>
                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Services</p>
                    <p className="text-[11px] font-black text-gray-900">124</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Growth</p>
                    <p className="text-[11px] font-black text-green-600">+8.2%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md">
                    <MapPin size={8} className="text-blue-500" />
                    <span className="text-[7px] font-black text-gray-500 uppercase">Tier 1</span>
                  </div>
                  <button
                    onClick={() => handleToggleRequest(area)}
                    className={`w-8 h-4.5 rounded-full relative p-0.5 transition-colors ${area.status === 'active' ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform duration-300 ${area.status === 'active' ? 'translate-x-3' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Background Polish */}
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <MapPin size={100} />
              </div>
            </motion.div>
          ))}
        </div>

        {filteredAreas.length === 0 && !loading && (
          <div className="py-16 bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-400">
            <MapPin size={24} className="opacity-20" />
            <p className="text-[8px] font-black uppercase tracking-[0.2em]">Zero Nodes Identified</p>
          </div>
        )}
      </div>

      <LocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        locationState={editingLocation}
        onSave={handleSave}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Location"
        message={`Are you sure you want to delete ${locationToDelete?.name}? This action will perform a soft delete.`}
        confirmLabel="Delete Node"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        onConfirm={confirmToggle}
        title="Confirm Status Change"
        message={`Are you sure you want to change the status of ${locationToToggle?.name} to ${locationToToggle?.status === 'active' ? 'Offline' : 'Active'}?`}
        confirmLabel="Confirm Change"
        variant="info"
      />
    </div>
  );
};

export default CityToggleRegistry;

// --- Sub-component for Quick Status Rail (Used in LocationTable) ---

interface CityToggleProps {
  city: string;
  isActive: boolean;
  onChange: (city: string, value: boolean) => void;
}

export const CityToggle: React.FC<CityToggleProps> = ({ city, isActive, onChange }) => {
  return (
    <div 
      className={`p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group cursor-pointer ${
        isActive 
          ? 'bg-blue-50 border-blue-100 shadow-sm shadow-blue-50' 
          : 'bg-white border-gray-100 opacity-60 grayscale-[0.5]'
      }`}
      onClick={() => onChange(city, !isActive)}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
        isActive ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-400'
      }`}>
        <MapPin size={14} />
      </div>
      <div className="flex flex-col items-center">
        <p className={`text-[9px] font-black uppercase tracking-tighter text-center ${isActive ? 'text-blue-700' : 'text-gray-500'}`}>
          {city}
        </p>
        <div className={`w-1 h-1 rounded-full mt-1 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
      </div>
    </div>
  );
};
