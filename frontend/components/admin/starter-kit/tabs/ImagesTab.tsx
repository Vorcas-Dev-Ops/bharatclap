"use client";

import React, { useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Edit3, Save, X, CheckCircle } from 'lucide-react';
import { message } from 'antd';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

export default function ImagesTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kitId, setKitId] = useState('');
  const [images, setImages] = useState<any>({});
  
  const [messageApi, contextHolder] = message.useMessage();

  const imageSlots = [
    { id: 'banner', name: 'Header Banner', desc: 'Appears at the top of the provider payment page (1200x400px)' },
    { id: 'tshirt', name: 'T-Shirt Image', desc: 'Product shot of the uniform (800x800px)' },
    { id: 'bag', name: 'Bag Image', desc: 'Product shot of the carry bag (800x800px)' },
    { id: 'idcard', name: 'ID Card Mockup', desc: 'Visual representation of the ID card (800x800px)' },
    { id: 'kit', name: 'Welcome Kit Box', desc: 'Overall box or unboxing image (800x800px)' },
  ];

  useEffect(() => {
    fetchKitData();
  }, []);

  const fetchKitData = async () => {
    try {
      const res = await authFetch(`${API_URL}/starter-kits`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const activeKit = data[0];
          setKitId(activeKit._id);
          setImages(activeKit.images || {});
        }
      }
    } catch (error) {
      console.error(error);
      messageApi.error('Failed to fetch image configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        messageApi.error('File size must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev: any) => ({ ...prev, [slotId]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!kitId) {
      messageApi.error('No configuration found to update');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/starter-kits/${kitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      if (res.ok) {
        messageApi.success('Images updated successfully');
        setIsEditing(false);
      } else {
        messageApi.error('Failed to update images');
      }
    } catch (error) {
      console.error(error);
      messageApi.error('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500 font-bold">Loading assets...</div>;
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      {contextHolder}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Assets & Imagery</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Upload images that will be displayed to the provider during the onboarding and payment flow.</p>
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setIsEditing(false); fetchKitData(); }} 
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              <X size={16} /> Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all text-sm shadow-md shadow-blue-600/20 disabled:opacity-70"
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Assets'}
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setIsEditing(true)} 
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all text-sm shadow-md shadow-slate-900/20"
          >
            <Edit3 size={16} /> Edit Assets
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imageSlots.map((slot) => {
          const currentImage = images[slot.id];

          return (
            <div key={slot.id} className={`border rounded-2xl p-4 flex flex-col group ${isEditing ? 'border-blue-200 bg-blue-50/10' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">{slot.name}</h3>
                  <p className="text-[10px] font-medium text-slate-500 mt-0.5">{slot.desc}</p>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentImage ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                  {currentImage ? <CheckCircle size={16} /> : <ImageIcon size={16} />}
                </div>
              </div>

              {currentImage ? (
                <div className="relative flex-1 rounded-xl overflow-hidden border border-slate-200 bg-white flex items-center justify-center p-2 h-40">
                  <img src={currentImage} alt={slot.name} className="max-h-full max-w-full object-contain rounded-lg" />
                  {isEditing && (
                    <label className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                      <UploadCloud size={24} className="text-white mb-2" />
                      <span className="text-xs font-bold text-white">Replace Image</span>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(slot.id, e)} />
                    </label>
                  )}
                </div>
              ) : (
                <label className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 h-40 transition-all bg-white ${isEditing ? 'border-blue-300 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30' : 'border-slate-200 cursor-not-allowed opacity-60'}`}>
                  <UploadCloud size={24} className={`${isEditing ? 'text-blue-400 group-hover:text-blue-500' : 'text-slate-300'} mb-2 transition-colors`} />
                  <span className={`text-xs font-bold ${isEditing ? 'text-slate-600 group-hover:text-blue-600' : 'text-slate-400'} transition-colors`}>{isEditing ? 'Click to upload image' : 'No image set'}</span>
                  <span className="text-[10px] font-medium text-slate-400 mt-1">JPG, PNG up to 2MB</span>
                  <input type="file" className="hidden" accept="image/*" disabled={!isEditing} onChange={(e) => handleFileChange(slot.id, e)} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
