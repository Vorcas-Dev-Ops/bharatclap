"use client";

import React from 'react';
import { Star, MapPin, CheckCircle2, XCircle, Eye, ShieldCheck, Briefcase } from 'lucide-react';
import Badge from '../common/Badge';

import { Provider } from '../types';

interface ProviderCardProps {
  provider: Provider;
  onApprove: (p: Provider) => void;
  onReject: (p: Provider) => void;
  onView: (p: Provider) => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onApprove, onReject, onView }) => {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[2.5rem] p-6 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.05)] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 group relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-[0.03] transition-opacity duration-700 ${
        provider.kyc_status === 'verified' ? 'bg-green-500' : provider.kyc_status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
      }`} />

      {/* Header with Avatar and Rating */}
      <div className="flex items-start justify-between relative z-10">
        <div className="relative">
          <img 
            src={provider.user_id.profile_image || `https://ui-avatars.com/api/?name=${provider.user_id.name}&background=f8f9ff&color=4f46e5&bold=true`} 
            alt={provider.user_id.name} 
            className="w-16 h-16 rounded-[1.5rem] object-cover ring-4 ring-gray-50 group-hover:rotate-3 transition-transform" 
          />
          {provider.kyc_status === 'verified' && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full border-4 border-white flex items-center justify-center text-white shadow-sm">
               <ShieldCheck size={12} strokeWidth={3} />
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
           <Badge variant={provider.kyc_status === 'verified' ? 'success' : provider.kyc_status === 'pending' ? 'warning' : 'danger'}>
              {provider.kyc_status}
           </Badge>
           <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-100/50">
              <Star size={14} className="fill-yellow-500 text-yellow-500" />
              <span className="text-xs font-black text-yellow-700 leading-none">5.0</span>
           </div>
        </div>
      </div>

      {/* Identity Info */}
      <div className="mt-6 relative z-10">
        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{provider.user_id.name}</h3>
        <div className="flex items-center gap-2 mt-2">
           <div className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider">
              <Briefcase size={12} />
              {provider.services?.[0]?.subservice_ids?.[0]?.subservice_name || 'Consultant'}
           </div>
           <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold">
              <MapPin size={12} />
              Unassigned
           </div>
        </div>
      </div>

      {/* Progress/Summary Line */}
      <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
         <div>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-none">Registration</p>
            <p className="text-[13px] font-bold text-gray-700 mt-1.5">{new Date(provider.createdAt).toLocaleDateString()}</p>
         </div>
         <button 
           onClick={() => onView(provider)}
           className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white hover:scale-110 active:scale-95 transition-all duration-300 shadow-sm"
         >
            <Eye size={18} />
         </button>
      </div>

      {/* Actions (Only visible for Pending) */}
      {provider.kyc_status === 'pending' && (
        <div className="mt-5 grid grid-cols-2 gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
           <button 
             onClick={() => onApprove(provider)}
             className="flex items-center justify-center gap-2 py-3 bg-green-50 text-green-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all shadow-sm"
           >
              <CheckCircle2 size={14} /> Approve
           </button>
           <button 
             onClick={() => onReject(provider)}
             className="flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
           >
              <XCircle size={14} /> Reject
           </button>
        </div>
      )}
    </div>
  );
};

export default ProviderCard;
