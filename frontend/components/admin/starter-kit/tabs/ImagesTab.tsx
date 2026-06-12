"use client";

import React from 'react';
import { UploadCloud, Image as ImageIcon } from 'lucide-react';

export default function ImagesTab() {
  const imageSlots = [
    { id: 'banner', name: 'Header Banner', desc: 'Appears at the top of the provider payment page (1200x400px)' },
    { id: 'tshirt', name: 'T-Shirt Image', desc: 'Product shot of the uniform (800x800px)' },
    { id: 'bag', name: 'Bag Image', desc: 'Product shot of the carry bag (800x800px)' },
    { id: 'idcard', name: 'ID Card Mockup', desc: 'Visual representation of the ID card (800x800px)' },
    { id: 'kit', name: 'Welcome Kit Box', desc: 'Overall box or unboxing image (800x800px)' },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-800">Assets & Imagery</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Upload images that will be displayed to the provider during the onboarding and payment flow.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imageSlots.map((slot) => (
          <div key={slot.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex flex-col group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">{slot.name}</h3>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">{slot.desc}</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <ImageIcon size={16} />
              </div>
            </div>

            <label className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-all bg-white">
              <UploadCloud size={24} className="text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="text-xs font-bold text-slate-600 group-hover:text-blue-600 transition-colors">Click to upload image</span>
              <span className="text-[10px] font-medium text-slate-400 mt-1">JPG, PNG up to 2MB</span>
              <input type="file" className="hidden" accept="image/*" />
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
