"use client";

import React, { useState, useEffect } from 'react';
import { X, Tag, Percent, Banknote, Calendar, Layers, Activity, Ticket, LayoutGrid } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../common/Button';
import { IOffer, ProviderService } from '../types';

interface OfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    offerState: IOffer | null;
    providerServices: ProviderService[];
}

const OfferModal: React.FC<OfferModalProps> = ({ isOpen, onClose, onSave, offerState, providerServices }) => {
    const [formData, setFormData] = useState({
        code: '',
        coupon_id: '',
        provider_service_id: '',
        discount_type: 'flat' as 'flat' | 'percentage',
        discount_value: 0,
        min_amount: 0,
        expiry_date: '',
        status: 'active' as 'active' | 'inactive'
    });

    useEffect(() => {
        if (offerState) {
            setFormData({
                code: offerState.code,
                coupon_id: offerState.coupon_id || '',
                provider_service_id: offerState.provider_service_id || '',
                discount_type: offerState.discount_type,
                discount_value: offerState.discount_value,
                min_amount: offerState.min_amount,
                expiry_date: offerState.expiry_date ? new Date(offerState.expiry_date).toISOString().split('T')[0] : '',
                status: offerState.status
            });
        } else {
            setFormData({
                code: '',
                coupon_id: '',
                provider_service_id: '',
                discount_type: 'flat',
                discount_value: 0,
                min_amount: 0,
                expiry_date: '',
                status: 'active'
            });
        }
    }, [offerState, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-md"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/20 overflow-hidden"
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Ticket size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase">
                                {offerState ? 'Edit Campaign' : 'New Campaign Offer'}
                            </h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Define marketing incentives</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-2xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Code */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <Tag size={12} className="text-blue-500" /> Offer Code
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="E.G. NEW2025"
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>

                        {/* Coupon ID */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <Activity size={12} className="text-blue-500" /> Reference ID
                            </label>
                            <input
                                type="text"
                                value={formData.coupon_id}
                                onChange={(e) => setFormData({ ...formData, coupon_id: e.target.value })}
                                placeholder="External ID (Optional)"
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>

                        {/* Discount Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <Percent size={12} className="text-blue-500" /> Type
                            </label>
                            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl">
                                {['flat', 'percentage'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, discount_type: type as any })}
                                        className={`flex-1 py-3.5 rounded-xl text-[10px] font-black tracking-widest transition-all ${formData.discount_type === type ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Discount Value */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <Banknote size={12} className="text-blue-500" /> Value
                            </label>
                            <input
                                required
                                type="number"
                                value={formData.discount_value}
                                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>

                        {/* Min Amount */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <LayoutGrid size={12} className="text-blue-500" /> Min. Amount (₹)
                            </label>
                            <input
                                required
                                type="number"
                                value={formData.min_amount}
                                onChange={(e) => setFormData({ ...formData, min_amount: parseFloat(e.target.value) })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>

                        {/* Expiry Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                <Calendar size={12} className="text-blue-500" /> Validity
                            </label>
                            <input
                                required
                                type="date"
                                value={formData.expiry_date}
                                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>
                    </div>

                    {/* Provider Service Link */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <Layers size={12} className="text-blue-500" /> Link to Specific Provider Service (Optional)
                        </label>
                        <select
                            value={formData.provider_service_id}
                            onChange={(e) => setFormData({ ...formData, provider_service_id: e.target.value })}
                            className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[12px] font-bold text-gray-800 focus:bg-white focus:border-blue-200 transition-all outline-none appearance-none"
                        >
                            <option value="">Apply Globally to All Services</option>
                            {providerServices.map(ps => {
                                const providerName = typeof ps.provider_id === 'object' ? ps.provider_id.user_id.name : 'Unknown';
                                return (
                                    <option key={ps._id} value={ps._id}>
                                        {providerName} - {ps.subservice_ids?.[0]?.subservice_name || 'Service'} (₹{ps.price})
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Status */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                        <div className="space-y-1">
                            <label className="text-[11px] font-black text-gray-900 tracking-widest flex items-center gap-2">
                                <Activity size={14} className="text-blue-500" /> System Status
                            </label>
                            <p className="text-[10px] text-gray-400 font-bold ml-5">Determine if this campaign is live</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                            className={`w-12 h-6 rounded-full relative p-1 transition-colors duration-300 shadow-inner ${formData.status === 'active' ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md flex items-center justify-center ${formData.status === 'active' ? 'translate-x-6' : 'translate-x-0'
                                }`}>
                                {formData.status === 'active' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />}
                            </div>
                        </button>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4">
                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-4 rounded-2xl shadow-xl shadow-blue-500/20 bg-blue-600 text-[11px] font-black uppercase tracking-[0.2em]"
                        >
                            {offerState ? 'Commit Changes' : 'Initialize Campaign'}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default OfferModal;
