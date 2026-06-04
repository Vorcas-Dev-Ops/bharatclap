"use client";
import React from 'react';
import { Pencil as Edit, Pause, Play, Trash2 } from 'lucide-react';
import Badge from '../common/Badge';

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
}

interface BannerCardProps {
  banner: Banner;
  onEdit?: (b: Banner) => void;
  onDelete?: (b: Banner) => void;
  onToggle?: (b: Banner) => void;
}

const BannerCard: React.FC<BannerCardProps> = ({ banner, onEdit, onDelete, onToggle }) => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-200 transition-all duration-500 group">
      <div className="h-40 bg-gray-100 relative overflow-hidden">
        <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="absolute top-2 right-2">
          <Badge variant={banner.status === 'active' ? 'success' : 'danger'}>
            {banner.status === 'active' ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="absolute bottom-2 left-3 right-3">
          <h3 className="font-bold text-white text-sm truncate">{banner.title}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>Order: {banner.display_order}</span>
          <span>Target: {banner.redirect_url || banner.redirect_type}</span>
        </div>
        {banner.subtitle && (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{banner.subtitle}</p>
        )}
        <div className="flex justify-between items-center mt-1">
          <button onClick={() => onEdit?.(banner)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"><Edit size={16} /></button>
          <button onClick={() => onDelete?.(banner)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  );
};
export default BannerCard;
