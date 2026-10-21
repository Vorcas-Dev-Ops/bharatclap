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
  Tags,
  Users,
  CornerDownRight,
  ArrowLeft
} from 'lucide-react';

import Button from '../common/Button';
import ConfirmationModal from '../common/ConfirmationModal';
import CategoryModal from '../categories/CategoryModal';
import ServiceModal from './ServiceModal';
import SubServiceModal from '../sub-services/SubServiceModal';
import CategoryIcon from '@/components/common/CategoryIcon';

type ViewState = "category" | "service";

// ==========================================
// Sub-Components for Cards
// ==========================================

const StatusToggle = ({ status, onClick }: { status: string, onClick: (e: React.MouseEvent) => void }) => {
  const isActive = status === 'active';
  return (
    <button
      onClick={onClick}
      className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 shadow-inner ${isActive ? 'bg-green-600' : 'bg-red-500'}`}
      title={isActive ? 'Active - click to deactivate' : 'Inactive - click to activate'}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 z-10 ${isActive ? 'translate-x-6' : 'translate-x-0'}`} />
      <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[7px] font-black uppercase tracking-tighter text-white pointer-events-none">
        <span className={`transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>ON</span>
        <span className={`transition-opacity duration-300 ${isActive ? 'opacity-0' : 'opacity-100'}`}>OFF</span>
      </div>
    </button>
  );
};

const ActionButtons = ({ 
  onEdit, 
  onDelete, 
  size = "sm" 
}: { 
  onEdit: (e: React.MouseEvent) => void, 
  onDelete: (e: React.MouseEvent) => void,
  size?: "sm" | "xs"
}) => (
  <div className="flex gap-1.5">
    <button 
      onClick={onEdit} 
      className={`flex items-center gap-1 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all font-black uppercase tracking-wider ${
        size === "xs" ? "px-2.5 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"
      }`}
    >
      <Pencil size={size === "xs" ? 10 : 12} /> Edit
    </button>
    <button 
      onClick={onDelete} 
      className={`flex items-center gap-1 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black uppercase tracking-wider ${
        size === "xs" ? "px-2.5 py-1 text-[9px]" : "px-3 py-1.5 text-[10px]"
      }`}
    >
      <Trash2 size={size === "xs" ? 10 : 12} /> Delete
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
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const [isSubServiceModalOpen, setIsSubServiceModalOpen] = useState(false);
  const [editingSubService, setEditingSubService] = useState<any>(null);
  const [subServiceParentService, setSubServiceParentService] = useState<any>(null);

  const [deleteItem, setDeleteItem] = useState<{type: "category" | "service" | "subservice", data: any} | null>(null);
  const [statusItem, setStatusItem] = useState<{type: "category" | "service" | "subservice", data: any} | null>(null);

  useEffect(() => {
    if (view === "category") {
      fetchCategories();
    } else if (view === "service" && selectedCategory) {
      const catId = selectedCategory.id || selectedCategory._id;
      if (catId) {
        fetchCategoryHierarchy(catId);
      }
    }
  }, [view, selectedCategory]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/categories?includeInactive=true');
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryHierarchy = async (categoryId: string) => {
    setLoading(true);
    try {
      const [srvRes, subRes] = await Promise.all([
        apiClient.get(`/services?category_id=${categoryId}&includeInactive=true`),
        apiClient.get(`/sub-services?category_id=${categoryId}&includeInactive=true`),
      ]);
      const sData = Array.isArray(srvRes.data) ? srvRes.data : (srvRes.data?.data || []);
      const subData = Array.isArray(subRes.data) ? subRes.data : (subRes.data?.data || []);
      setServices(sData);
      setSubServices(subData);
    } catch (error) {
      console.error('Error fetching category hierarchy:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToCategories = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setView("category");
  };

  const openCategoryDetails = (category: any) => {
    setSelectedCategory(category);
    setSearchTerm('');
    setView("service");
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    const { type, data } = deleteItem;
    const itemId = data.id || data._id;
    try {
      if (type === "category") {
        await apiClient.delete(`/categories/${itemId}`);
        setDeleteItem(null);
        fetchCategories();
      } else if (type === "service") {
        await apiClient.delete(`/services/${itemId}`);
        setDeleteItem(null);
        const catId = selectedCategory?.id || selectedCategory?._id;
        if (catId) fetchCategoryHierarchy(catId);
      } else if (type === "subservice") {
        await apiClient.delete(`/sub-services/${itemId}`);
        setDeleteItem(null);
        const catId = selectedCategory?.id || selectedCategory?._id;
        if (catId) fetchCategoryHierarchy(catId);
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
    const itemId = data.id || data._id;
    const newStatus = data.status === 'active' ? 'inactive' : 'active';
    try {
      if (type === "category") {
        await apiClient.put(`/categories/${itemId}`, { status: newStatus });
        setStatusItem(null);
        fetchCategories();
      } else if (type === "service") {
        await apiClient.put(`/services/${itemId}`, { status: newStatus });
        setStatusItem(null);
        const catId = selectedCategory?.id || selectedCategory?._id;
        if (catId) fetchCategoryHierarchy(catId);
      } else if (type === "subservice") {
        await apiClient.put(`/sub-services/${itemId}`, { status: newStatus });
        setStatusItem(null);
        const catId = selectedCategory?.id || selectedCategory?._id;
        if (catId) fetchCategoryHierarchy(catId);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      console.error('[ServicesManager] Status update failed:', msg);
      alert('Failed to update status: ' + msg);
    }
  };

  const handleSaveCategory = async (data: any) => {
    try {
      if (editingCategory) {
        const catId = editingCategory.id || editingCategory._id;
        await apiClient.put(`/categories/${catId}`, data);
      } else {
        await apiClient.post('/categories', data);
      }
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.userMessage || error?.message || 'Unknown error';
      console.error('Error saving category:', msg);
      alert('Failed to save category: ' + msg);
    }
  };

  const handleSaveService = async (data: any) => {
    try {
      if (editingService) {
        const srvId = editingService.id || editingService._id;
        await apiClient.put(`/services/${srvId}`, data);
      } else {
        await apiClient.post('/services', data);
      }
      setIsServiceModalOpen(false);
      setEditingService(null);
      const catId = selectedCategory?.id || selectedCategory?._id;
      if (catId) fetchCategoryHierarchy(catId);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.userMessage || error?.message || 'Unknown error';
      console.error('Error saving service:', msg);
      alert('Failed to save service: ' + msg);
    }
  };

  const handleSaveSubService = async (data: any) => {
    try {
      if (editingSubService) {
        const subId = editingSubService.id || editingSubService._id;
        await apiClient.put(`/sub-services/${subId}`, data);
      } else {
        await apiClient.post('/sub-services', data);
      }
      setIsSubServiceModalOpen(false);
      setEditingSubService(null);
      setSubServiceParentService(null);
      const catId = selectedCategory?.id || selectedCategory?._id;
      if (catId) fetchCategoryHierarchy(catId);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.userMessage || error?.message || 'Unknown error';
      console.error('Error saving subservice:', msg);
      alert('Failed to save subservice: ' + msg);
    }
  };

  const getSubservicesForService = (serviceId: string) => {
    return subServices.filter(sub => {
      let sid = '';
      if (sub.service_id && typeof sub.service_id === 'object') {
        sid = sub.service_id.id || sub.service_id._id || '';
      } else if (sub.service_id) {
        sid = String(sub.service_id);
      }
      return sid === serviceId;
    });
  };

  const filteredCategories = categories.filter(c => 
    (c.category_name || c.name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServices = services.filter(s => {
    const term = searchTerm.toLowerCase();
    const serviceNameMatches = (s.service_name || s.name || "").toLowerCase().includes(term);
    const sId = s.id || s._id;
    const subservicesForThis = getSubservicesForService(sId);
    const subserviceMatches = subservicesForThis.some(sub => 
      (sub.subservice_name || sub.name || "").toLowerCase().includes(term)
    );
    return serviceNameMatches || subserviceMatches;
  });

  // ==========================================
  // Level 1: Category Cards Grid
  // ==========================================
  const renderCategoryCard = (item: any) => {
    const catId = item.id || item._id;
    const catName = item.category_name || item.name || 'Category';
    const sCount = Number(item.services_count ?? 0);
    const subCount = Number(item.subservices_count ?? 0);

    return (
      <motion.div
        key={catId}
        layout
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.03)" }}
        onClick={() => openCategoryDetails(item)}
        className={`bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 transition-all cursor-pointer group flex flex-col relative overflow-hidden min-h-[220px] ${item.status === 'inactive' ? 'opacity-80 grayscale-[20%]' : ''}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform duration-500">
            <CategoryIcon
              icon={item.icon || item.image || (item.images && item.images[0])}
              name={catName}
              className="w-8 h-8 text-blue-600"
            />
          </div>
          <div onClick={e => e.stopPropagation()}>
            <StatusToggle status={item.status} onClick={(e) => { e.stopPropagation(); setStatusItem({ type: 'category', data: item }); }} />
          </div>
        </div>
        
        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors capitalize tracking-tight mb-2">
          {catName}
        </h3>
        <p className="text-[11px] font-bold text-gray-500 line-clamp-2 leading-relaxed flex-1">
          {item.description || 'No description provided.'}
        </p>
        
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 text-gray-500">
            <Layers size={14} className="text-blue-500" />
            <span className={sCount > 0 ? "text-blue-700 font-extrabold" : "text-gray-400"}>
              {sCount} {sCount === 1 ? 'Service' : 'Services'}
            </span>
            {subCount > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-emerald-600 font-extrabold">{subCount} Sub-services</span>
              </>
            )}
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
  };

  // ==========================================
  // Level 2: Nested Hierarchy inside Category
  // Category -> Services -> Sub-services
  // ==========================================
  const renderCategoryHierarchyView = () => {
    const catName = selectedCategory?.category_name || selectedCategory?.name || 'Category';
    const catIcon = selectedCategory?.icon || selectedCategory?.image;

    return (
      <div className="space-y-6">
        {/* Category Header Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                <CategoryIcon
                  icon={catIcon}
                  name={catName}
                  className="w-9 h-9 text-white"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black tracking-widest uppercase bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                    Category Hierarchy
                  </span>
                  <span className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${selectedCategory.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {selectedCategory.status}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1 capitalize">
                  {catName}
                </h2>
                <p className="text-xs text-blue-200/80 font-medium mt-1 max-w-xl line-clamp-2">
                  {selectedCategory.description || 'Manage all service packages and sub-service offerings in this category.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl border border-white/10 text-center">
                <div className="text-xl font-black text-white">{services.length}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-blue-200">Services</div>
              </div>
              <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl border border-white/10 text-center">
                <div className="text-xl font-black text-emerald-300">{subServices.length}</div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Sub-services</div>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingService(null);
                  setIsServiceModalOpen(true);
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] uppercase tracking-wider py-3 px-5 rounded-xl shadow-lg border-0"
              >
                Add Service
              </Button>
            </div>
          </div>
        </div>

        {/* Services & Sub-services Tree */}
        <div className="space-y-6">
          {filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-gray-100 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                <Layers size={32} />
              </div>
              <div>
                <h4 className="text-base font-black text-gray-900">No Services in this Category</h4>
                <p className="text-xs text-gray-500 font-medium mt-1">Get started by creating the first service offering.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingService(null);
                  setIsServiceModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] uppercase tracking-wider py-2.5 px-6 rounded-xl shadow"
              >
                Create Service
              </Button>
            </div>
          ) : (
            filteredServices.map((service, index) => {
              const sId = service.id || service._id;
              const sName = service.service_name || service.name || 'Service';
              const serviceSubServices = getSubservicesForService(sId);

              return (
                <div 
                  key={sId}
                  className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden transition-all hover:border-blue-100"
                >
                  {/* Service Row (Parent Header) */}
                  <div className="p-6 bg-gradient-to-r from-gray-50/70 via-white to-gray-50/40 border-b border-gray-100">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      
                      {/* Service Info */}
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          {(service.image || (service.images && service.images[0])) ? (
                            <img 
                              src={service.image || service.images[0]} 
                              alt="service" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <Wrench size={24} className="text-blue-500" />
                          )}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              Service #{index + 1}
                            </span>
                            {service.genderApplicability && (
                              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                service.genderApplicability === 'women'
                                  ? 'bg-pink-50 border-pink-100 text-pink-600'
                                  : service.genderApplicability === 'men'
                                  ? 'bg-blue-50 border-blue-100 text-blue-600'
                                  : 'bg-purple-50 border-purple-100 text-purple-600'
                              }`}>
                                <Users size={9} className="inline mr-1 -mt-0.5" />
                                {service.genderApplicability === 'women' ? 'Women Only' : service.genderApplicability === 'men' ? 'Men Only' : service.genderApplicability}
                              </span>
                            )}
                            <span className="text-[10px] font-black text-gray-400">
                              • {serviceSubServices.length} {serviceSubServices.length === 1 ? 'Sub-service' : 'Sub-services'}
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-gray-900 capitalize tracking-tight mt-0.5">
                            {sName}
                          </h3>
                          <p className="text-[11px] font-bold text-gray-500 line-clamp-1 max-w-xl">
                            {service.description || 'Standard service offering.'}
                          </p>
                        </div>
                      </div>

                      {/* Pricing, Duration & Actions */}
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
                        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-gray-100 text-[11px] font-black text-gray-700">
                          <span className="flex items-center gap-1 text-emerald-600">
                            <IndianRupee size={13} /> {service.base_price || 0}
                          </span>
                          <span className="text-gray-300">|</span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock size={13} /> {service.duration || 60}m
                          </span>
                        </div>

                        <StatusToggle 
                          status={service.status} 
                          onClick={() => setStatusItem({ type: 'service', data: service })} 
                        />

                        <button
                          onClick={() => {
                            setEditingSubService(null);
                            setSubServiceParentService(service);
                            setIsSubServiceModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider"
                          title="Add sub-service under this service"
                        >
                          <Plus size={12} /> Add Sub-service
                        </button>

                        <ActionButtons 
                          onEdit={() => { setEditingService(service); setIsServiceModalOpen(true); }}
                          onDelete={() => { setDeleteItem({ type: 'service', data: service }); }}
                        />
                      </div>

                    </div>
                  </div>

                  {/* Sub-services Nested Tree View */}
                  <div className="p-6 bg-white">
                    <div className="flex items-center gap-2 mb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">
                      <CornerDownRight size={14} className="text-blue-500" />
                      <span>Sub-services under &quot;{sName}&quot; ({serviceSubServices.length})</span>
                    </div>

                    {serviceSubServices.length === 0 ? (
                      <div className="border border-dashed border-gray-200 rounded-2xl p-6 text-center bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-left">
                          <p className="text-xs font-black text-gray-700">No sub-services attached yet</p>
                          <p className="text-[11px] text-gray-400 font-medium">Add the specific tasks or packages that customers can book under this service.</p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingSubService(null);
                            setSubServiceParentService(service);
                            setIsSubServiceModalOpen(true);
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition"
                        >
                          + Add First Sub-service
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pl-0 sm:pl-4 border-l-2 border-blue-100/60">
                        {serviceSubServices.map((subItem) => {
                          const subId = subItem.id || subItem._id;
                          const subName = subItem.subservice_name || subItem.name || 'Sub-service';
                          const subPrice = subItem.base_price || subItem.basePrice || 0;
                          const subDuration = subItem.duration || 45;

                          return (
                            <div 
                              key={subId}
                              className={`p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all flex flex-col justify-between ${
                                subItem.status === 'inactive' ? 'opacity-70 bg-gray-50/50' : ''
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="w-10 h-10 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                    {(subItem.image || (subItem.images && subItem.images[0])) ? (
                                      <img 
                                        src={subItem.image || subItem.images[0]} 
                                        alt="subservice" 
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon size={18} />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <StatusToggle 
                                      status={subItem.status} 
                                      onClick={() => setStatusItem({ type: 'subservice', data: subItem })} 
                                    />
                                  </div>
                                </div>

                                <h4 className="text-sm font-black text-gray-900 capitalize tracking-tight line-clamp-1">
                                  {subName}
                                </h4>
                                <p className="text-[10px] text-gray-500 font-bold line-clamp-2 mt-1 mb-3">
                                  {subItem.description || 'Standard subservice offering.'}
                                </p>

                                {/* Badges */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {subItem.packages && subItem.packages.length > 0 && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-1">
                                      <Layers size={10} /> {subItem.packages.length} Packages
                                    </span>
                                  )}
                                  {subItem.variants && subItem.variants.length > 0 && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1">
                                      <Tags size={10} /> {subItem.variants.length} Variants
                                    </span>
                                  )}
                                  {subItem.service_preparations && subItem.service_preparations.length > 0 && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
                                      <ListChecks size={10} /> {subItem.service_preparations.length} Prep
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-700">
                                  <span className="text-emerald-700">₹${subPrice}</span>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-amber-600">${subDuration}m</span>
                                </div>

                                <ActionButtons 
                                  size="xs"
                                  onEdit={() => { 
                                    setEditingSubService(subItem); 
                                    setSubServiceParentService(service);
                                    setIsSubServiceModalOpen(true); 
                                  }}
                                  onDelete={() => { 
                                    setDeleteItem({ type: 'subservice', data: subItem }); 
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-6">
        
        {/* Navigation Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide text-[11px] font-black uppercase tracking-widest text-gray-500">
          <button 
            onClick={navigateToCategories}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              view === "category" 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                : "hover:bg-blue-50 hover:text-blue-600 bg-white border border-gray-100"
            }`}
          >
            <Home size={14} /> Categories
          </button>
          
          {view === "service" && selectedCategory && (
            <>
              <ChevronRight size={14} className="text-gray-300" />
              <button 
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200 transition-all"
              >
                <Layers size={14} /> {selectedCategory.category_name || selectedCategory.name}
              </button>
            </>
          )}
        </div>

        {/* Toolbar Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full max-w-md">
            {view === "service" && (
              <button
                onClick={navigateToCategories}
                className="p-3 bg-white border border-gray-100 rounded-2xl hover:bg-gray-50 text-gray-600 transition shadow-sm"
                title="Back to Categories"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input
                type="text"
                placeholder={view === "category" ? "Search categories..." : "Search services or sub-services..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all shadow-sm"
              />
            </div>
          </div>

          {view === "category" && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="shadow-lg bg-blue-600 text-[11px] py-3.5 rounded-2xl px-6 whitespace-nowrap tracking-widest font-black uppercase"
            >
              Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <RefreshCw size={32} className="text-blue-600 animate-spin" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Loading Catalog...</span>
          </div>
        ) : view === "category" ? (
          filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-50 bg-white/40 border border-gray-100 border-dashed rounded-[2rem]">
              <Layers size={48} strokeWidth={1} className="text-gray-400" />
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Categories Found</span>
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
                {filteredCategories.map((item) => renderCategoryCard(item))}
              </AnimatePresence>
            </motion.div>
          )
        ) : (
          renderCategoryHierarchyView()
        )}
      </div>

      {/* Form Modals */}
      <CategoryModal 
        isOpen={isCategoryModalOpen} 
        onClose={() => setIsCategoryModalOpen(false)} 
        category={editingCategory} 
        onSave={handleSaveCategory} 
      />
      
      {selectedCategory && (
        <ServiceModal 
          isOpen={isServiceModalOpen} 
          onClose={() => setIsServiceModalOpen(false)} 
          service={editingService} 
          category={selectedCategory} 
          onSave={handleSaveService} 
        />
      )}

      {subServiceParentService && (
        <SubServiceModal 
          isOpen={isSubServiceModalOpen} 
          onClose={() => {
            setIsSubServiceModalOpen(false);
            setEditingSubService(null);
            setSubServiceParentService(null);
          }} 
          subService={editingSubService} 
          service={subServiceParentService} 
          onSave={handleSaveSubService} 
        />
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteItem?.type === 'category' ? 'Category' : deleteItem?.type === 'service' ? 'Service' : 'Subservice'}?`}
        message={`Are you sure you want to delete this ${deleteItem?.type}? This will remove it from the active catalog.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={!!statusItem}
        onClose={() => setStatusItem(null)}
        onConfirm={confirmStatusChange}
        title={`${statusItem?.data.status === 'active' ? 'Deactivate' : 'Activate'} ${statusItem?.type === 'category' ? 'Category' : statusItem?.type === 'service' ? 'Service' : 'Subservice'}?`}
        message={`Are you sure you want to change status to ${statusItem?.data.status === 'active' ? 'inactive' : 'active'}?`}
        confirmLabel={statusItem?.data.status === 'active' ? 'Deactivate' : 'Activate'}
        variant={statusItem?.data.status === 'active' ? 'warning' : 'info'}
      />

    </div>
  );
}
