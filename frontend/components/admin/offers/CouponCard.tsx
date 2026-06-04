"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Copy, 
  Edit2, 
  Trash2, 
  BarChart2, 
  Power,
  Calendar,
  Users,
  Info,
  CheckCircle,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Tooltip, Tag, message } from 'antd';

interface CouponCardProps {
  coupon: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onViewAnalytics: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({ coupon, onEdit, onDelete, onToggle, onViewAnalytics }) => {
  const isExpired = new Date(coupon.expiryDate) < new Date();
  const statusColor = coupon.status === 'active' ? 'bg-green-500' : 'bg-gray-400';
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    message.success('Coupon code copied!');
  };

  const getGradient = () => {
    if (coupon.highlightGradient) return coupon.highlightGradient;
    if (coupon.discountType === 'percentage') return 'from-blue-600 to-indigo-600';
    if (coupon.discountType === 'flat') return 'from-purple-600 to-pink-600';
    return 'from-emerald-600 to-teal-600';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -5 }}
      className="relative flex flex-col h-full bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300"
    >
      {/* Top Section - Ticket Part */}
      <div className={`relative h-32 bg-gradient-to-br ${getGradient()} p-6 overflow-hidden`}>
        {/* Background Patterns */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl" />
        
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/30">
              {coupon.discountType.replace('_', ' ')}
            </span>
            <div className="flex gap-1.5">
              <button 
                onClick={onEdit}
                className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors"
              >
                <Edit2 size={14} />
              </button>
              <button 
                onClick={onToggle}
                className={`w-8 h-8 rounded-lg ${coupon.status === 'active' ? 'bg-white/20' : 'bg-red-500/40'} backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40 transition-colors`}
              >
                <Power size={14} />
              </button>
            </div>
          </div>
          
          <div className="mt-auto">
            <h2 className="text-3xl font-black text-white leading-none">
              {coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}
              <span className="text-sm font-bold ml-2 uppercase opacity-80">OFF</span>
            </h2>
          </div>
        </div>

        {/* Ticket Cut-outs */}
        <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-gray-50/50 rounded-full border border-gray-100" />
        <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-gray-50/50 rounded-full border border-gray-100" />
        
        {/* Dashed Line */}
        <div className="absolute bottom-0 left-4 right-4 border-b-2 border-dashed border-white/30" />
      </div>

      {/* Bottom Section */}
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-black text-gray-900 leading-tight mb-1 truncate w-full">
              {coupon.name}
            </h3>
            <p className="text-xs font-bold text-gray-500 line-clamp-2">
              {coupon.description}
            </p>
          </div>
        </div>

        {/* Code Section */}
        <div className="bg-gray-50 rounded-2xl p-3 flex items-center justify-between mb-4 border border-gray-100 group-hover:border-blue-100 transition-colors">
          <span className="text-sm font-black text-gray-800 tracking-wider">
            {coupon.code}
          </span>
          <button 
            onClick={handleCopyCode}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
          >
            <Copy size={14} />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-y-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Calendar size={12} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Expires</span>
              <span className="text-[11px] font-black text-gray-700">
                {new Date(coupon.expiryDate).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <Users size={12} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Used</span>
              <span className="text-[11px] font-black text-gray-700">
                {coupon.usageCount || 0} times
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
              <Info size={12} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Min Order</span>
              <span className="text-[11px] font-black text-gray-700">₹{coupon.minOrderAmount}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <BarChart2 size={12} />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Limit</span>
              <span className="text-[11px] font-black text-gray-700">{coupon.usageLimit || 'Unlimited'}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center gap-2 pt-4 border-t border-gray-50">
          <button 
            onClick={onViewAnalytics}
            className="flex-1 h-10 rounded-xl bg-gray-50 text-gray-600 text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 hover:text-blue-600 transition-all"
          >
            <BarChart2 size={14} />
            ANALYTICS
          </button>
          <button 
            onClick={onDelete}
            className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Badges */}
      {coupon.autoApply && (
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-400 text-black text-[9px] font-black rounded-full shadow-sm z-20 uppercase tracking-tighter">
          Auto
        </div>
      )}
      {coupon.isFeatured && (
        <div className="absolute top-2 left-12 px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full shadow-sm z-20 uppercase tracking-tighter">
          Featured
        </div>
      )}
    </motion.div>
  );
};

export default CouponCard;
