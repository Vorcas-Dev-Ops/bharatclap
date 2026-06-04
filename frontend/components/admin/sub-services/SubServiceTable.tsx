"use client";

import React, { useState, useEffect } from 'react';
import {
    Zap, Droplets, Wind, Hammer, Paintbrush, Trash2, Plus, Pencil, Power,
    Search, Filter, RefreshCw, BarChart3, ChevronLeft, LayoutGrid, Layers, ArrowLeft, ChevronRight
} from 'lucide-react';
import Table from '../common/Table';
import Button from '../common/Button';
import Badge from '../common/Badge';
import SubServiceModal from './SubServiceModal';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../common/ConfirmationModal';
import CategorySelectCard from '../categories/CategorySelectCard';
import axios from 'axios';

import { API_URL } from '@/config/api';

const SubServiceTable: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    const [subServices, setSubServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
    const [selectedService, setSelectedService] = useState<any | null>(null);
    
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/categories`);
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedCategory) {
            fetchServices();
        } else {
            setServices([]);
            setSelectedService(null);
        }
    }, [selectedCategory]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/services?category_id=${selectedCategory._id}`);
            setServices(response.data);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedService) {
            fetchSubServices();
        } else {
            setSubServices([]);
        }
    }, [selectedService]);

    const fetchSubServices = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/sub-services?service_id=${selectedService._id}`);
            setSubServices(response.data);
        } catch (error) {
            console.error('Error fetching sub-services:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubService, setEditingSubService] = useState<any>(null);
    const [subServiceToDelete, setSubServiceToDelete] = useState<any>(null);
    const [subServiceChangingStatus, setSubServiceChangingStatus] = useState<any>(null);
    
    const [filterStatus, setFilterStatus] = useState('All');
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

    const handleStatusToggle = async () => {
        if (!subServiceChangingStatus) return;
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const newStatus = subServiceChangingStatus.status === 'active' ? 'inactive' : 'active';
            await axios.put(`${API_URL}/sub-services/${subServiceChangingStatus._id}`, {
                ...subServiceChangingStatus,
                status: newStatus
            }, config);
            fetchSubServices();
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setSubServiceChangingStatus(null);
        }
    };

    const handleDelete = async () => {
        if (!subServiceToDelete) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/sub-services/${subServiceToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchSubServices();
        } catch (error) {
            console.error('Error deleting sub-service:', error);
            alert('Failed to delete sub-service.');
        } finally {
            setSubServiceToDelete(null);
        }
    };

    const filteredSubServices = subServices.filter(s =>
        ((s.subservice_name || "").toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus === 'All' || (s.status || "").toLowerCase() === filterStatus.toLowerCase())
    );

    const handleOpenAdd = () => {
        setEditingSubService(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (subService: any) => {
        setEditingSubService(subService);
        setIsModalOpen(true);
    };

    const handleSave = async (savedSubService: any) => {
        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            if (editingSubService) {
                await axios.put(`${API_URL}/sub-services/${editingSubService._id}`, savedSubService, config);
            } else {
                await axios.post(`${API_URL}/sub-services`, savedSubService, config);
            }
            fetchSubServices();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving sub-service:', error);
            alert('Failed to save sub-service.');
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        {selectedService ? (
                            <span className="flex items-center gap-2 flex-wrap">
                                Sub-Services<span className="text-blue-600">.</span>
                                <span className="text-gray-300 text-xl font-light">/</span>
                                <span className="text-gray-400 text-lg">{selectedCategory.category_name.toLowerCase()}</span>
                                <span className="text-gray-300 text-xl font-light">/</span>
                                <span className="text-blue-600">{selectedService.service_name.toLowerCase()}</span>
                            </span>
                        ) : selectedCategory ? (
                            <span className="flex items-center gap-2">
                                Select<span className="text-blue-600"> Service</span>
                                <span className="text-gray-300 text-2xl font-light">/</span>
                                <span className="text-blue-600">{selectedCategory.category_name.toLowerCase()}</span>
                            </span>
                        ) : (
                            <>Sub-Services<span className="text-blue-600">.</span></>
                        )}
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1 italic">
                        {selectedService ? `Manage specific offerings in ${selectedService.service_name}` : 
                         selectedCategory ? 'Choose a service to manage its sub-offerings' : 
                         'Select a category to begin'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {selectedService ? (
                        <Button
                            variant="outline"
                            size="sm"
                            icon={ArrowLeft}
                            onClick={() => setSelectedService(null)}
                            className="text-[10px] bg-white border-gray-100 uppercase tracking-widest shadow-sm px-4 rounded-xl"
                        >
                            Back to Services
                        </Button>
                    ) : selectedCategory ? (
                        <Button
                            variant="outline"
                            size="sm"
                            icon={ArrowLeft}
                            onClick={() => setSelectedCategory(null)}
                            className="text-[10px] bg-white border-gray-100 uppercase tracking-widest shadow-sm px-4 rounded-xl"
                        >
                            Back to Categories
                        </Button>
                    ) : null}

                    {selectedService && (
                        <Button 
                            variant="primary" 
                            size="sm" 
                            icon={Plus} 
                            onClick={handleOpenAdd}
                            className="shadow-lg bg-blue-600 text-[11px] py-3 rounded-2xl px-5"
                        >
                            Add Sub-Service
                        </Button>
                    )}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {!selectedCategory ? (
                    <motion.div
                        key="category-grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                    >


                        {categories.map((cat) => (
                            <CategorySelectCard 
                                key={cat._id} 
                                category={cat} 
                                onClick={() => setSelectedCategory(cat)}
                            />
                        ))}

                    </motion.div>
                ) : !selectedService ? (
                    <motion.div
                        key="service-grid"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
                    >

                        {services.map((svc) => (
                            <motion.div
                                key={svc._id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ 
                                    y: -8, 
                                    scale: 1.02,
                                    boxShadow: "0 20px 25px -5px rgba(59, 130, 246, 0.1), 0 10px 10px -5px rgba(59, 130, 246, 0.04)"
                                }}
                                whileTap={{ scale: 0.98 }}
                                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                onClick={() => setSelectedService(svc)}
                                className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:border-blue-200 transition-colors duration-300 flex flex-col cursor-pointer group border border-gray-50 scale-[0.98] min-h-[280px]"
                            >
                                {/* Top Image Section */}
                                <div className="h-32 w-full bg-gray-50 overflow-hidden relative border-b border-gray-50">
                                    {svc.image && svc.image.startsWith('http') ? (
                                        <img 
                                            src={svc.image} 
                                            alt={svc.service_name} 
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-200">
                                            <Layers size={40} strokeWidth={1} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                </div>

                                {/* Content Section */}
                                <div className="p-5 flex flex-col items-center text-center flex-1 justify-center">
                                    <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em] leading-tight transition-colors group-hover:text-blue-600 mb-2">
                                        {svc.service_name}
                                    </h3>
                                    <p className="text-[8px] text-gray-400 font-bold leading-relaxed line-clamp-2 uppercase tracking-wider opacity-80">
                                        {svc.description || 'Professional service offering with expert care'}
                                    </p>
                                    
                                    <div className="mt-4 w-6 h-0.5 bg-blue-600 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
                                </div>
                            </motion.div>


                        ))}

                        {services.length === 0 && (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                                <Layers size={40} strokeWidth={1} className="opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No services found in this category</p>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="sub-service-table"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        {/* Table Control Rail */}
                        <div className="bg-white/40 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/60 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4 relative z-20">
                            <div className="relative flex-1 w-full group max-w-sm">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder={`Search in ${selectedService.service_name}...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-100 focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-100/50 rounded-xl text-[11px] font-bold text-gray-800 transition-all duration-300 shadow-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2 relative">
                                <Button 
                                    variant={filterStatus !== 'All' ? "primary" : "outline"} 
                                    size="sm" 
                                    icon={Filter} 
                                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    className={`text-[10px] uppercase tracking-widest shadow-sm px-4 ${filterStatus !== 'All' ? 'bg-blue-600' : 'bg-white border-gray-100'}`}
                                >
                                    {filterStatus !== 'All' ? filterStatus : 'Filters'}
                                </Button>
                                <button
                                    onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}
                                    className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden min-h-[400px]">
                            <Table
                                headers={['Sub-Service Name', 'Base Price', 'Duration', 'Variants', 'Status', 'Actions']}
                            >

                                <AnimatePresence mode="popLayout" initial={false}>
                                    {filteredSubServices.map((s) => (
                                        <motion.tr
                                            layout
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            key={s._id}
                                            className="hover:bg-blue-50/20 transition-all border-b border-gray-50 last:border-0 text-[11px]"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-50">
                                                        {s.image ? <img src={s.image} alt={s.subservice_name} className="w-full h-full object-cover" /> : <BarChart3 size={16} />}
                                                    </div>
                                                    <span className="font-black text-gray-900 tracking-tight uppercase text-[10px]">{s.subservice_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-[8px] font-bold text-gray-400">INR</span>
                                                    <span className="font-black text-gray-900 tracking-tighter text-[13px]">{s.base_price}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">{s.duration} Mins</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black tracking-widest border border-blue-100 uppercase">
                                                    {(s.variants || []).length} Packages
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => setSubServiceChangingStatus(s)}
                                                    className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 ${s.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${s.status === 'active' ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button onClick={() => handleOpenEdit(s)} className="p-1 px-3 text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={12} /></button>
                                                    <button onClick={() => setSubServiceToDelete(s)} className="p-1 px-3 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={12} /></button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </Table>
                            {filteredSubServices.length === 0 && (
                                <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                                    <Layers size={40} strokeWidth={1} className="opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No sub-services found</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <SubServiceModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                subService={editingSubService}
                service={selectedService || ''}
                onSave={handleSave}
            />

            <ConfirmationModal
                isOpen={!!subServiceToDelete}
                onClose={() => setSubServiceToDelete(null)}
                onConfirm={handleDelete}
                title="Sub-Service Removal"
                message={`Are you sure you want to permanently delete "${subServiceToDelete?.subservice_name}"?`}
                confirmLabel="Delete"
                variant="danger"
            />
            <ConfirmationModal
                isOpen={!!subServiceChangingStatus}
                onClose={() => setSubServiceChangingStatus(null)}
                onConfirm={handleStatusToggle}
                title="Status Change"
                message={`Change status for "${subServiceChangingStatus?.subservice_name}"?`}
                confirmLabel="Update"
                variant="info"
            />
        </div>
    );
};

export default SubServiceTable;
