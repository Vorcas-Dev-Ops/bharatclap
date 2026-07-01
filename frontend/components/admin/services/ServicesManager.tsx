"use client";

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/config/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Home,
  Layers,
  Wrench,
  Image as ImageIcon,
  CheckCircle,
  Clock,
  IndianRupee,
  CalendarDays,
  ListChecks,
  Tags
} from 'lucide-react';

import Button from '../common/Button';
import ConfirmationModal from '../common/ConfirmationModal';
import CategoryModal from '../categories/CategoryModal';
import ServiceModal from './ServiceModal';
import SubServiceModal from '../sub-services/SubServiceModal';

type ViewState = "category" | "service" | "subservice";

// ==========================================
// Sub-Components for Cards
// ==========================================

const StatusToggle = ({ status, onClick }: { status: string, onClick: (e: React.MouseEvent) => void }) => {
  const isActive = status === 'active';
  return (
    <button
      onClick={onClick}
      className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 shadow-inner ${isActive ? 'bg-green-600' : 'bg-red-500'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 z-10 ${isActive ? 'translate-x-6' : 'translate-x-0'}`} />
      <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[7px] font-black uppercase tracking-tighter text-white pointer-events-none">
        <span className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>ON</span>
        <span className={`transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100'}`}>OFF</span>
      </div>
    </button>
  );
};

const ActionButtons = ({ onEdit, onDelete }: { onEdit: (e: React.MouseEvent) => void, onDelete: (e: React.MouseEvent) => void }) => (
  <div className="flex gap-2">
    <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
      <Pencil size={12} /> Edit
    </button>
    <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest">
      <Trash2 size={12} /> Delete
    </button>
  </div>
);

// ==========================================
// Main Component
// ==========================================

export default function ServicesManager() {
  const [view, setView] = useState<ViewState>("category");
  
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [subServices, setSubServices] = useState<any[]>([]);
  
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const [isSubServiceModalOpen, setIsSubServiceModalOpen] = useState(false);
  const [editingSubService, setEditingSubService] = useState<any>(null);

  const [deleteItem, setDeleteItem] = useState<{type: ViewState, data: any} | null>(null);
  const [statusItem, setStatusItem] = useState<{type: ViewState, data: any} | null>(null);

  useEffect(() => {
    if (view === "category") {
      fetchCategories();
    } else if (view === "service" && selectedCategory) {
      fetchServices(selectedCategory._id);
    } else if (view === "subservice" && selectedService) {
      fetchSubServices(selectedService._id);
    }
  }, [view, selectedCategory, selectedService]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/categories?includeInactive=true');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async (categoryId: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/services?category_id=${categoryId}&includeInactive=true`);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubServices = async (serviceId: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/sub-services?service_id=${serviceId}&includeInactive=true`);
      setSubServices(response.data);
    } catch (error) {
      console.error('Error fetching subservices:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (targetView: ViewState) => {
    setSearchTerm('');
    if (targetView === "category") {
      setSelectedCategory(null);
      setSelectedService(null);
      setView("category");
    } else if (targetView === "service") {
      setSelectedService(null);
      setView("service");
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    const { type, data } = deleteItem;
    try {
      if (type === "category") {
        await apiClient.delete(`/categories/${data._id}`);
        setDeleteItem(null);
        fetchCategories();
      } else if (type === "service") {
        await apiClient.delete(`/services/${data._id}`);
        setDeleteItem(null);
        if (selectedCategory) fetchServices(selectedCategory._id);
      } else if (type === "subservice") {
        await apiClient.delete(`/sub-services/${data._id}`);
        setDeleteItem(null);
        if (selectedService) fetchSubServices(selectedService._id);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('[ServicesManager] Delete failed:', msg, error);
      alert('Failed to delete: ' + msg);
    }
  };

  const confirmStatusChange = async () => {
    if (!statusItem) return;
    const { type, data } = statusItem;
    const newStatus = data.status === 'active' ? 'inactive' : 'active';
    try {
      if (type === "category") {
        await apiClient.put(`/categories/${data._id}`, { status: newStatus });
        setStatusItem(null);
        fetchCategories();
      } else if (type === "service") {
        await apiClient.put(`/services/${data._id}`, { status: newStatus });
        setStatusItem(null);
        if (selectedCategory) fetchServices(selectedCategory._id);
      } else if (type === "subservice") {
        await apiClient.put(`/sub-services/${data._id}`, { status: newStatus });
        setStatusItem(null);
        if (selectedService) fetchSubServices(selectedService._id);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('[ServicesManager] Status update failed:', msg, error?.response?.status, error?.response?.data);
      alert('Failed to update status: ' + msg);
    }
  };

  const handleSaveCategory = async (data: any) => {
    try {
      if (editingCategory) {
        await apiClient.put(`/categories/${editingCategory._id}`, data);
      } else {
        await apiClient.post('/categories', data);
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error.response?.data || error.message);
      alert('Failed to save category: ' + (error?.response?.data?.message || error.message));
    }
  };

  const handleSaveService = async (data: any) => {
    try {
      if (editingService) {
        await apiClient.put(`/services/${editingService._id}`, data);
      } else {
        await apiClient.post('/services', data);
      }
      setIsServiceModalOpen(false);
      setEditingService(null);
      if (selectedCategory) fetchServices(selectedCategory._id);
    } catch (error: any) {
      console.error('Error saving service:', error.response?.data || error.message);
      alert('Failed to save service: ' + (error?.response?.data?.message || error.message));
    }
  };

  const handleSaveSubService = async (data: any) => {
    try {
      if (editingSubService) {
        await apiClient.put(`/sub-services/${editingSubService._id}`, data);
      } else {
        await apiClient.post('/sub-services', data);
      }
      setIsSubServiceModalOpen(false);
      setEditingSubService(null);
      if (selectedService) fetchSubServices(selectedService._id);
    } catch (error: any) {
      console.error('Error saving subservice:', error.response?.data || error.message);
      alert('Failed to save subservice: ' + (error?.response?.data?.message || error.message));
    }
  };

  const getFilteredData = () => {
    const term = searchTerm.toLowerCase();
    if (view === "category") {
      return categories.filter(c => (c.category_name || "").toLowerCase().includes(term));
    } else if (view === "service") {
      return services.filter(s => (s.service_name || "").toLowerCase().includes(term));
    } else {
      return subServices.filter(ss => (ss.subservice_name || "").toLowerCase().includes(term));
    }
  };

  const filteredData = getFilteredData();

  const renderCategoryCard = (item: any) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      onClick={() => { setSelectedCategory(item); setSearchTerm(''); setView("service"); }}
      className={`bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 transition-all cursor-pointer group flex flex-col relative overflow-hidden min-h-[220px] ${item.status === 'inactive' ? 'opacity-80 grayscale-[20%]' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform duration-500">
          {(item.icon || item.image || (item.images && item.images[0])) ? (
            <img src={item.icon || item.image || (item.images && item.images[0])} alt="icon" className="w-full h-full object-cover" />
          ) : (
            <Home size={28} className="text-blue-500" />
          )}
        </div>
        <div onClick={e => e.stopPropagation()}>
          <StatusToggle status={item.status} onClick={(e) => { e.stopPropagation(); setStatusItem({ type: 'category', data: item }); }} />
        </div>
      </div>
      
      <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors capitalize tracking-tight mb-2">
        {item.category_name}
      </h3>
      <p className="text-[11px] font-bold text-gray-500 line-clamp-2 leading-relaxed flex-1">
        {item.description || 'No description provided.'}
      </p>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Layers size={14} className="text-blue-500" /> {item.services_count || 0} Services
        </div>
        <div onClick={e => e.stopPropagation()}>
          <ActionButtons 
            onEdit={(e) => { e.stopPropagation(); setEditingCategory(item); setIsCategoryModalOpen(true); }}
            onDelete={(e) => { e.stopPropagation(); setDeleteItem({ type: 'category', data: item }); }}
          />
        </div>
      </div>
    </motion.div>
  );

  const renderServiceCard = (item: any) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
      onClick={() => { setSelectedService(item); setSearchTerm(''); setView("subservice"); }}
      className={`bg-white rounded-[2rem] shadow-sm border border-gray-100 transition-all cursor-pointer group flex flex-col relative overflow-hidden min-h-[300px] ${item.status === 'inactive' ? 'opacity-80 grayscale-[20%]' : ''}`}
    >
      <div className="h-40 w-full bg-gray-100 relative overflow-hidden border-b border-gray-100">
        {(item.image || (item.images && item.images[0])) ? (
          <img src={item.image || (item.images && item.images[0])} alt="service" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon size={40} />
          </div>
        )}
        <div className="absolute top-4 right-4" onClick={e => e.stopPropagation()}>
          <div className="bg-white/90 backdrop-blur p-1 rounded-full shadow-lg">
            <StatusToggle status={item.status} onClick={(e) => { e.stopPropagation(); setStatusItem({ type: 'service', data: item }); }} />
          </div>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors capitalize tracking-tight mb-2">
          {item.service_name}
        </h3>
        <p className="text-[11px] font-bold text-gray-500 line-clamp-2 leading-relaxed mb-4">
          {item.description || 'Professional service offering.'}
        </p>

        <div className="flex gap-4 mb-4 mt-auto">
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-700">
            <IndianRupee size={14} className="text-green-600" /> {item.base_price}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-gray-700">
            <Clock size={14} className="text-amber-500" /> {item.duration} MINS
          </div>
        </div>
        
        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Wrench size={14} className="text-blue-500" /> {item.subservices_count || 0} Subservices
          </div>
          <div onClick={e => e.stopPropagation()}>
            <ActionButtons 
              onEdit={(e) => { e.stopPropagation(); setEditingService(item); setIsServiceModalOpen(true); }}
              onDelete={(e) => { e.stopPropagation(); setDeleteItem({ type: 'service', data: item }); }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderSubserviceCard = (item: any) => {
    const updatedAt = new Date(item.updatedAt || item.createdAt || Date.now());
    const daysAgo = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 3600 * 24));
    const timeDisplay = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 Day Ago' : `${daysAgo} Days Ago`;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
        className={`bg-white rounded-[2rem] shadow-sm border border-gray-100 transition-all flex flex-col relative overflow-hidden min-h-[380px] ${item.status === 'inactive' ? 'opacity-80 grayscale-[20%]' : ''}`}
      >
        <div className="h-32 w-full bg-gray-100 relative overflow-hidden border-b border-gray-100">
          {(item.image || (item.images && item.images[0])) ? (
            <img src={item.image || (item.images && item.images[0])} alt="subservice" className="w-full h-full object-cover transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={32} />
            </div>
          )}
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-1 rounded-full shadow-lg">
            <StatusToggle status={item.status} onClick={() => setStatusItem({ type: 'subservice', data: item })} />
          </div>
        </div>
        
        <div className="p-5 flex flex-col flex-1">
          <h3 className="text-base font-black text-gray-900 capitalize tracking-tight mb-1">
            {item.subservice_name}
          </h3>
          <p className="text-[10px] font-bold text-gray-500 line-clamp-2 leading-relaxed mb-4">
            {item.description || 'Standard subservice offering.'}
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 p-3 rounded-2xl">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Pricing</span>
              {item.packages && item.packages.length > 0 ? (
                <span className="text-[11px] font-black text-blue-600 flex items-center gap-1">
                  <Layers size={12} /> {item.packages.length} Packages
                </span>
              ) : (
                <span className="text-[12px] font-black text-gray-900 flex items-center gap-0.5">
                  ₹{item.base_price || '0'}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Duration</span>
              <span className="text-[11px] font-black text-gray-900 flex items-center gap-1">
                <Clock size={12} className="text-amber-500" /> {item.duration || '60'} mins
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {item.variants && item.variants.length > 0 && (
              <div className="group/variant relative px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-lg text-[9px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1 cursor-help">
                <Tags size={10} /> {item.variants.length} Variants
                
                {/* Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[9px] font-bold p-3 rounded-xl opacity-0 group-hover/variant:opacity-100 pointer-events-none transition-opacity z-50">
                  <ul className="space-y-1 text-left normal-case tracking-normal">
                    {item.variants.slice(0, 3).map((variant: any, i: number) => (
                      <li key={i} className="flex gap-1.5"><CheckCircle size={10} className="text-purple-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{typeof variant === 'string' ? variant : variant.name} (₹{variant.price || 0})</span></li>
                    ))}
                    {item.variants.length > 3 && (
                      <li className="text-gray-400 text-center mt-1 italic uppercase tracking-widest text-[8px]">+{item.variants.length - 3} more</li>
                    )}
                  </ul>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            )}
            
            {item.service_preparations && item.service_preparations.length > 0 && (
              <div className="group/prep relative px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 cursor-help">
                <ListChecks size={10} /> {item.service_preparations.length} Prep Items
                
                {/* Hover Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-[9px] font-bold p-3 rounded-xl opacity-0 group-hover/prep:opacity-100 pointer-events-none transition-opacity z-50">
                  <ul className="space-y-1">
                    {item.service_preparations.slice(0, 3).map((prep: any, i: number) => (
                      <li key={i} className="flex gap-1.5"><CheckCircle size={10} className="text-emerald-400 shrink-0 mt-0.5" /> <span className="line-clamp-2">{typeof prep === 'string' ? prep : (prep.title || prep.instruction || 'Preparation step')}</span></li>
                    ))}
                    {item.service_preparations.length > 3 && (
                      <li className="text-gray-400 text-center mt-1 italic">+{item.service_preparations.length - 3} more</li>
                    )}
                  </ul>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="group/date relative text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 cursor-help">
              <CalendarDays size={12} /> Updated {timeDisplay}
              <div className="absolute bottom-full left-0 mb-2 w-max bg-gray-900 text-white text-[9px] font-bold p-2 rounded-lg opacity-0 group-hover/date:opacity-100 pointer-events-none transition-opacity z-50">
                {updatedAt.toLocaleDateString()} {updatedAt.toLocaleTimeString()}
                <div className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
              </div>
            </div>
            
            <ActionButtons 
              onEdit={() => { setEditingSubService(item); setIsSubServiceModalOpen(true); }}
              onDelete={() => { setDeleteItem({ type: 'subservice', data: item }); }}
            />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-6">
        
        {/* Navigation Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide text-[11px] font-black uppercase tracking-widest text-gray-500">
          <button 
            onClick={() => navigateTo("category")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${view === "category" ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "hover:bg-blue-50 hover:text-blue-600"}`}
          >
            <Home size={14} /> Categories
          </button>
          
          {(view === "service" || view === "subservice") && selectedCategory && (
            <>
              <ChevronRight size={14} className="text-gray-300" />
              <button 
                onClick={() => navigateTo("service")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${view === "service" ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "hover:bg-blue-50 hover:text-blue-600"}`}
              >
                <Layers size={14} /> {selectedCategory.category_name}
              </button>
            </>
          )}

          {view === "subservice" && selectedService && (
            <>
              <ChevronRight size={14} className="text-gray-300" />
              <button 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 transition-all"
              >
                <Wrench size={14} /> {selectedService.service_name}
              </button>
            </>
          )}
        </div>

        {/* Toolbar Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
            <input
              type="text"
              placeholder={`Search ${view === "category" ? "categories" : view === "service" ? "services" : "subservices"}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all shadow-sm"
            />
          </div>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => {
              if (view === "category") {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              } else if (view === "service") {
                setEditingService(null);
                setIsServiceModalOpen(true);
              } else {
                setEditingSubService(null);
                setIsSubServiceModalOpen(true);
              }
            }}
            className="shadow-lg bg-blue-600 text-[11px] py-3.5 rounded-2xl px-6 whitespace-nowrap tracking-widest font-black uppercase"
          >
            Add {view === "category" ? "Category" : view === "service" ? "Service" : "Subservice"}
          </Button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <RefreshCw size={32} className="text-blue-600 animate-spin" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading Content...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-50 bg-white/40 border border-gray-100 border-dashed rounded-[2rem]">
            <Layers size={48} strokeWidth={1} className="text-gray-400" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Items Found</span>
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } },
              hidden: {}
            }}
          >
            <AnimatePresence mode="popLayout">
              {filteredData.map((item) => (
                <React.Fragment key={item._id}>
                  {view === "category" && renderCategoryCard(item)}
                  {view === "service" && renderServiceCard(item)}
                  {view === "subservice" && renderSubserviceCard(item)}
                </React.Fragment>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Form Modals */}
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        category={editingCategory} 
        onSave={handleSaveCategory} 
      />
      
      {view === "service" && selectedCategory && (
        <ServiceModal 
          isOpen={isServiceModalOpen} 
          onClose={() => setIsServiceModalOpen(false)} 
          service={editingService} 
          category={selectedCategory} 
          onSave={handleSaveService} 
        />
      )}

      {view === "subservice" && selectedService && (
        <SubServiceModal 
          isOpen={isSubServiceModalOpen} 
          onClose={() => setIsSubServiceModalOpen(false)} 
          subService={editingSubService} 
          service={selectedService} 
          onSave={handleSaveSubService} 
        />
      )}

      {/* Confirmation Modals */}
      
      <ConfirmationModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteItem?.type === 'category' ? 'Category' : deleteItem?.type === 'service' ? 'Service' : 'Subservice'}?`}
        message={
          deleteItem?.type === 'category' 
            ? `This action cannot be undone. Deleting this category will affect all associated services.`
            : deleteItem?.type === 'service'
            ? `Deleting this service will affect all subservices.`
            : `Delete this subservice?`
        }
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={!!statusItem}
        onClose={() => setStatusItem(null)}
        onConfirm={confirmStatusChange}
        title="STATUS TRANSITION"
        message={
          <div className="text-gray-500 font-medium px-4">
            Are you sure you want to change the status of<br />
            "{statusItem?.data?.category_name || statusItem?.data?.service_name || statusItem?.data?.subservice_name}"<br />
            from {statusItem?.data?.status || 'active'} to {statusItem?.data?.status === 'active' ? 'inactive' : 'active'}?
          </div>
        }
        confirmLabel="UPDATE STATUS"
        cancelLabel="MAINTAIN STATE"
        variant="info"
      />

    </div>
  );
}
