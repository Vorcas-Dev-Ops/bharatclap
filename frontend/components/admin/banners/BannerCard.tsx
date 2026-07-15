"use client";
import React from 'react';
import { Pencil as Edit, Trash2, Eye, MoreVertical, ArrowRight } from 'lucide-react';

export interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  image_url: string;
  redirect_type: 'category' | 'service' | 'url' | 'none';
  redirect_id?: string;
  redirect_url?: string;
  button_text?: string;
  display_order: number;
  status: 'active' | 'inactive';
  role?: 'user' | 'provider';
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface BannerCardProps {
  banner: Banner;
  onEdit?: (b: Banner) => void;
  onDelete?: (b: Banner) => void;
  onPreview?: (b: Banner) => void;
  onToggle?: (b: Banner) => void;
}

const BannerCard: React.FC<BannerCardProps> = ({ banner, onEdit, onDelete, onPreview }) => {
  const formatDate = (dateVal?: string | Date) => {
    if (!dateVal) return '15 Jul 2025';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '15 Jul 2025';
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return '15 Jul 2025';
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-4 border border-gray-200/80 hover:border-blue-300 hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-full group">
      <div>
        {/* Banner Graphic Preview Box */}
        <div className="h-44 sm:h-48 rounded-xl overflow-hidden relative bg-slate-900 shadow-inner flex flex-col justify-between p-4 isolate">
          <img 
            src={banner.image_url} 
            alt={banner.title} 
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-85" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 -z-10" />

          {/* Top Row: Decorative tag & 3-dots */}
          <div className="flex items-center justify-between z-10 w-full">
            <span className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-bold uppercase tracking-widest text-white/90">
              {banner.role === 'provider' ? 'Partner Offer' : 'Exclusive Deal'}
            </span>
            <button 
              type="button"
              onClick={() => onEdit?.(banner)}
              className="p-1 rounded-lg bg-black/30 hover:bg-black/50 text-white transition-colors"
            >
              <MoreVertical size={14} />
            </button>
          </div>

          {/* Bottom Row: Title & Action Overlay */}
          <div className="z-10 mt-auto">
            <h3 className="font-extrabold text-white text-base sm:text-lg leading-tight drop-shadow-md line-clamp-2">
              {banner.title}
            </h3>
            {banner.button_text && (
              <div className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-slate-900 text-[11px] font-extrabold shadow-sm hover:bg-blue-50 transition-colors">
                  {banner.button_text} <ArrowRight size={12} className="text-blue-600" />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Badges Row */}
        <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold border ${
            banner.status === 'active' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${banner.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {banner.status === 'active' ? 'Active' : 'Inactive'}
          </span>

          <span className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider ${
            banner.role === 'provider' 
              ? 'bg-purple-100 text-purple-700' 
              : 'bg-blue-100 text-blue-700'
          }`}>
            {banner.role === 'provider' ? 'PROVIDER' : 'USER'}
          </span>

          <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-gray-100 text-gray-800">
            Order #{banner.display_order}
          </span>
        </div>

        {/* Target, Created, and Updated in SAME ROW for all */}
        <div className="mt-3 grid grid-cols-3 gap-2 py-2.5 px-3 bg-gray-50/80 rounded-xl border border-gray-100/80 text-[11px]">
          <div className="flex flex-col truncate">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Target</span>
            <span className="font-semibold text-gray-800 truncate" title={banner.redirect_url || banner.redirect_type}>
              {banner.redirect_url || banner.redirect_type || 'None'}
            </span>
          </div>
          <div className="flex flex-col truncate border-l border-gray-200/60 pl-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Created</span>
            <span className="font-medium text-gray-700 truncate">{formatDate(banner.createdAt)}</span>
          </div>
          <div className="flex flex-col truncate border-l border-gray-200/60 pl-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Updated</span>
            <span className="font-medium text-gray-700 truncate">{formatDate(banner.updatedAt)}</span>
          </div>
        </div>

        {/* Subtitle / Description Text */}
        {banner.subtitle && (
          <div className="mt-3">
            <p className="text-xs text-gray-600 line-clamp-2 font-medium leading-relaxed">
              {banner.subtitle}
            </p>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-4 pt-3.5 border-t border-gray-100 grid grid-cols-3 gap-2">
        <button 
          type="button"
          onClick={() => onPreview?.(banner)} 
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-2xs"
        >
          <Eye size={13} className="text-gray-500 shrink-0" /> Preview
        </button>

        <button 
          type="button"
          onClick={() => onEdit?.(banner)} 
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-2xs"
        >
          <Edit size={13} className="text-gray-500 shrink-0" /> Edit
        </button>

        <button 
          type="button"
          onClick={() => onDelete?.(banner)} 
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 border border-gray-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all shadow-2xs"
        >
          <Trash2 size={13} className="shrink-0" /> Delete
        </button>
      </div>
    </div>
  );
};

export default BannerCard;


