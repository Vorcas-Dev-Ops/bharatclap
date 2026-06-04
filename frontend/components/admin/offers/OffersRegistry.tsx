"use client";

import React, { useState, useEffect } from 'react';
import { Ticket, Search, Plus, Filter, RefreshCw, Tag, Calendar, LayoutGrid, Trash2, Pencil, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../../../config/api';
import { IOffer, ProviderService } from '../types';
import Button from '../common/Button';
import Table from '../common/Table';
import Badge from '../common/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import OfferModal from './OfferModal';
import ConfirmationModal from '../common/ConfirmationModal';

const OffersRegistry = () => {
    const [offers, setOffers] = useState<IOffer[]>([]);
    const [providerServices, setProviderServices] = useState<ProviderService[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOffer, setEditingOffer] = useState<IOffer | null>(null);
    const [offerToDelete, setOfferToDelete] = useState<IOffer | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [offerResp, serviceResp] = await Promise.all([
                axios.get(`${API_URL}/offers/admin`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }),
                axios.get(`${API_URL}/provider-services`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
            ]);
            setOffers(offerResp.data);
            setProviderServices(serviceResp.data);
        } catch (error) {
            console.error('Error fetching offers data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (formData: any) => {
        try {
            const token = localStorage.getItem('token');
            if (editingOffer) {
                await axios.put(`${API_URL}/offers/${editingOffer._id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/offers`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            fetchData();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving offer:', error);
        }
    };

    const handleDelete = async () => {
        if (!offerToDelete) return;
        try {
            await axios.delete(`${API_URL}/offers/${offerToDelete._id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            fetchData();
            setOfferToDelete(null);
        } catch (error) {
            console.error('Error deleting offer:', error);
        }
    };

    const filteredOffers = offers.filter(offer => {
        const matchesSearch = offer.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (offer.coupon_id?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = filterStatus === 'All' || offer.status === filterStatus.toLowerCase();
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* 1. Page Header */}
            <div>
                <h1 className="text-3xl font-black text-gray-900 tracking-tight">Offers</h1>
            </div>

            {/* 2. Strategy Control Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Left: Search and Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative group w-full sm:w-80">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search codes or campaign IDs..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-800 focus:border-blue-200 transition-all outline-none shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex items-center gap-1.5 p-1 bg-white border border-gray-100 rounded-2xl shadow-sm w-full sm:w-auto overflow-x-auto">
                        {['All', 'Active', 'Inactive'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                                    filterStatus === status ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    <button onClick={fetchData} className="p-2.5 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-blue-600 hover:shadow-md transition-all shadow-sm">
                        <RefreshCw size={16} />
                    </button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={() => { setEditingOffer(null); setIsModalOpen(true); }}
                        className="shadow-xl shadow-blue-500/20 bg-blue-600 text-[11px] py-2.5 rounded-2xl px-6 font-black uppercase tracking-widest w-full sm:w-auto"
                    >
                        Add Offer
                    </Button>
                </div>
            </div>

            {/* 3. Detailed Data Table */}
            <div className="bg-white/40 backdrop-blur-xl rounded-[2.5rem] border border-white/60 shadow-sm overflow-hidden min-h-[400px]">
                <Table
                    headers={['Campaign Code', 'Logic', 'Value', 'Min Order', 'Reference', 'Expiry', 'Status', 'Manage']}
                >
                    {filteredOffers.map((offer) => (
                        <tr key={offer._id} className="hover:bg-blue-50/20 transition-all text-[11px] group text-gray-700 border-b border-gray-50 last:border-0">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <Tag size={14} />
                                    </div>
                                    <span className="font-black text-gray-900 uppercase tracking-tight">{offer.code}</span>
                                </div>
                            </td>
                            <td className="px-6">
                                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                    offer.discount_type === 'percentage' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                    {offer.discount_type}
                                </span>
                            </td>
                            <td className="px-6 font-black text-gray-900">
                                {offer.discount_type === 'percentage' ? `${offer.discount_value}%` : `₹${offer.discount_value}`}
                            </td>
                            <td className="px-6 text-gray-500 font-bold">₹{offer.min_amount}</td>
                            <td className="px-6">
                                {offer.coupon_id ? (
                                    <div className="flex items-center gap-1.5 text-gray-400 hover:text-blue-600 cursor-pointer transition-colors">
                                        <ExternalLink size={10} />
                                        <span className="text-[10px] font-bold">{offer.coupon_id}</span>
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-gray-300 font-bold italic">Global</span>
                                )}
                            </td>
                            <td className="px-6">
                                <div className="flex items-center gap-2 text-gray-500">
                                    <Calendar size={12} className="opacity-40" />
                                    <span className="font-bold">{new Date(offer.expiry_date).toLocaleDateString()}</span>
                                </div>
                            </td>
                            <td className="px-6">
                                <Badge variant={offer.status === 'active' ? 'success' : 'neutral'}>
                                    {offer.status}
                                </Badge>
                            </td>
                            <td className="px-6">
                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => { setEditingOffer(offer); setIsModalOpen(true); }}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setOfferToDelete(offer)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {!loading && filteredOffers.length === 0 && (
                        <tr>
                            <td colSpan={8} className="py-20 text-center">
                                <div className="flex flex-col items-center gap-3 text-gray-300">
                                    <LayoutGrid size={40} className="opacity-20" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Scale your reach. Create your first offer.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

            {/* Modal Components */}
            <OfferModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                offerState={editingOffer}
                onSave={handleSave}
                providerServices={providerServices}
            />

            <ConfirmationModal 
                isOpen={!!offerToDelete}
                onClose={() => setOfferToDelete(null)}
                onConfirm={handleDelete}
                title="Deactivate Campaign"
                message={`Are you sure you want to permanently remove the "${offerToDelete?.code}" offer? This action cannot be undone.`}
                confirmLabel="Delete Offer"
                variant="danger"
            />
        </div>
    );
};

export default OffersRegistry;
