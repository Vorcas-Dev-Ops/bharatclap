"use client";

import React, { useState, useEffect } from 'react';
import {
    Zap, Droplets, Wind, Hammer, Paintbrush, Trash2, Plus, Pencil, Power,
    Search, Filter, RefreshCw, BarChart3, ChevronLeft, LayoutGrid, Layers, ArrowLeft
} from 'lucide-react';
import Table from '../common/Table';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ServiceModal from './ServiceModal';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../common/ConfirmationModal';
import CategoryCard from '../categories/CategoryCard';
import axios from 'axios';
import { API_URL } from '@/config/api';

const ServiceTable: React.FC = () => {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
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
    
    // Core data state
    const [services, setServices] = useState<any[]>([]);

    useEffect(() => {
        if (selectedCategory) {
            fetchServices();
        }
    }, [selectedCategory]);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/services?category_id=${selectedCategory._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setServices(response.data);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<any>(null);
    const [serviceToDelete, setServiceToDelete] = useState<any>(null);
    const [serviceChangingStatus, setServiceChangingStatus] = useState<any>(null);
    
    // Filter dropdown state
    const [filterStatus, setFilterStatus] = useState('All');
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

    const handleStatusToggle = async () => {
        if (!serviceChangingStatus) return;
        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };
            const newStatus = serviceChangingStatus.status === 'active' ? 'inactive' : 'active';
            await axios.put(`${API_URL}/services/${serviceChangingStatus._id}`, {
                ...serviceChangingStatus,
                status: newStatus
            }, config);
            fetchServices();
        } catch (error) {
            console.error('Error updating status:', error);
        } finally {
            setServiceChangingStatus(null);
        }
    };

    const handleDelete = async () => {
        if (!serviceToDelete) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_URL}/services/${serviceToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchServices();
        } catch (error) {
            console.error('Error deleting service:', error);
            alert('Failed to delete service.');
        } finally {
            setServiceToDelete(null);
        }
    };

    const filteredServices = services.filter(s =>
        ((s.service_name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
         (s.slug && s.slug.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (filterStatus === 'All' || (s.status || "").toLowerCase() === filterStatus.toLowerCase())
    );


    const handleOpenAdd = () => {
        setEditingService(null);
        setIsModalOpen(true);
    };

    const handleOpenEdit = (service: any) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleSave = async (savedService: any) => {
        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            if (editingService) {
                await axios.put(`${API_URL}/services/${editingService._id}`, savedService, config);
            } else {
                await axios.post(`${API_URL}/services`, savedService, config);
            }
            fetchServices();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving service:', error);
            alert('Failed to save service.');
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            {/* Header Evolution */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                        {selectedCategory ? (
                            <span className="flex items-center gap-2">
                                Services<span className="text-blue-600">.</span>
                                <span className="text-gray-300 text-2xl font-light">/</span>
                                <span className="text-blue-600">{selectedCategory.category_name.toLowerCase()}</span>
                            </span>
                        ) : (
                            <>Services<span className="text-blue-600">.</span></>
                        )}
                    </h1>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1 italic">
                        {selectedCategory ? `Manage services in ${selectedCategory.category_name}` : 'Select a category to manage services'}
                    </p>
                </div>

                {selectedCategory && (
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            icon={ArrowLeft}
                            onClick={() => setSelectedCategory(null)}
                            className="text-[10px] bg-white border-gray-100 uppercase tracking-widest shadow-sm px-4 rounded-xl"
                        >
                            Categories
                        </Button>
                        <Button 
                            variant="primary" 
                            size="sm" 
                            icon={Plus} 
                            onClick={handleOpenAdd}
                            className="shadow-lg bg-blue-600 text-[11px] py-3 rounded-2xl px-5"
                        >
                            Add Service
                        </Button>
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                {!selectedCategory ? (
                    <motion.div
                        key="category-grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                    >
                        {categories.map((cat) => (
                            <CategoryCard 
                                key={cat._id} 
                                category={cat} 
                                onClick={() => setSelectedCategory(cat)}
                            />
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="service-table"
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
                                    placeholder={`Search in ${selectedCategory.category_name}...`}
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
                                
                                <AnimatePresence>
                                    {isFilterDropdownOpen && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full right-8 mt-2 w-40 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden"
                                        >
                                            {['All', 'Active', 'Inactive'].map(status => (
                                                <button
                                                    key={status}
                                                    onClick={() => { setFilterStatus(status); setIsFilterDropdownOpen(false); }}
                                                    className={`w-full px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors ${filterStatus === status ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500'}`}
                                                >
                                                    {status === 'All' ? 'Show All' : status}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <button
                                    onClick={() => { setSearchTerm(''); setFilterStatus('All'); }}
                                    className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100"
                                    title="Reset view"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden group min-h-[460px] flex flex-col">
                            <div className="flex-1">
                                <Table
                                    headers={['Service Identity', 'Slug', 'Price/Time', 'Featured', 'Status', 'Actions']}
                                >

                                    <AnimatePresence mode="popLayout" initial={false}>
                                        {filteredServices.map((s) => (
                                            <motion.tr
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                key={s._id}
                                                className="hover:bg-blue-50/20 transition-all group/row border-b border-gray-50 last:border-0 text-[11px]"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition-transform group-hover/row:scale-110 overflow-hidden border border-gray-50">
                                                            {s.images && s.images[0] ? (
                                                                <img src={s.images[0]} alt={s.service_name} className="w-full h-full object-cover" />
                                                            ) : s.image ? (
                                                                <img src={s.image} alt={s.service_name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <BarChart3 size={16} />
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-gray-900 tracking-tight uppercase tracking-widest text-[10px]">{s.service_name}</span>
                                                            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest line-clamp-1">{s.description}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="font-bold text-blue-500 text-[10px] lowercase tracking-tight">/{s.slug || '-'}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <div className="flex items-baseline gap-1">
                                                            <span className="text-[8px] font-bold text-gray-400">₹</span>
                                                            <span className="font-black text-gray-900 tracking-tighter text-[13px]">{s.base_price}</span>
                                                        </div>
                                                        <span className="text-[8px] text-blue-600 font-black uppercase tracking-widest">{s.duration} Mins</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {s.is_featured ? (
                                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[8px] font-black tracking-widest border border-amber-200 uppercase">Featured</span>
                                                    ) : (
                                                        <span className="text-gray-300 text-[8px] font-black uppercase tracking-widest">Regular</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center">
                                                        <button
                                                            onClick={() => setServiceChangingStatus(s)}
                                                            className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 shadow-inner group/toggle ${s.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`}
                                                            title={s.status === 'active' ? 'Service Live' : 'Service Offline'}
                                                        >
                                                            {/* Sliding Indicator */}
                                                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 z-10 ${s.status === 'active' ? 'translate-x-6' : 'translate-x-0'}`} />

                                                            {/* ON/OFF Labels */}
                                                            <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[7px] font-black uppercase tracking-tighter text-white pointer-events-none">
                                                                <span className={`transition-opacity duration-300 ${s.status === 'active' ? 'opacity-100' : 'opacity-0'}`}>ON</span>
                                                                <span className={`transition-opacity duration-300 ${s.status === 'active' ? 'opacity-0' : 'opacity-100'}`}>OFF</span>
                                                            </div>
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1.5 transition-opacity">
                                                        <button 
                                                            onClick={() => handleOpenEdit(s)}
                                                            className="p-1 px-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 active:scale-95" 
                                                            title="Edit Service"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button 
                                                            onClick={() => setServiceToDelete(s)}
                                                            className="p-1 px-3 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 active:scale-95" 
                                                            title="Remove Entry"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </Table>

                                {filteredServices.length === 0 && (
                                    <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
                                        <Layers size={40} strokeWidth={1} className="opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No services cataloged for this category</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ServiceModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                service={editingService}
                category={selectedCategory || ''}
                onSave={handleSave}
            />

            <ConfirmationModal
                isOpen={!!serviceToDelete}
                onClose={() => setServiceToDelete(null)}
                onConfirm={handleDelete}
                title="Service Removal"
                message={`Are you sure you want to permanently delete "${serviceToDelete?.service_name}"? Action cannot be reversed.`}
                confirmLabel="Confirm Delete"
                cancelLabel="Keep Service"
                variant="danger"
            />
            <ConfirmationModal
                isOpen={!!serviceChangingStatus}
                onClose={() => setServiceChangingStatus(null)}
                onConfirm={handleStatusToggle}
                title="Status Transition"
                message={`Are you sure you want to change the status of "${serviceChangingStatus?.service_name}" from ${serviceChangingStatus?.status} to ${serviceChangingStatus?.status === 'active' ? 'inactive' : 'active'}?`}
                confirmLabel="Update Status"
                cancelLabel="Maintain State"
                variant="info"
            />
        </div>
    );
};

export default ServiceTable;
