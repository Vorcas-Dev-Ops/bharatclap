"use client";
import React, { useState } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';
import { CheckCircle2 } from 'lucide-react';

interface BannerFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const BannerForm: React.FC<BannerFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    subtitle: initialData?.subtitle || '',
    image_url: initialData?.image_url || '',
    redirect_type: initialData?.redirect_type || 'url',
    redirect_url: initialData?.redirect_url || '',
    button_text: initialData?.button_text || '',
    display_order: initialData?.display_order || 0,
    status: initialData?.status || 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="space-y-4 bg-white p-2" onSubmit={handleSubmit}>
      <Input label="Title" name="title" value={formData.title} onChange={handleChange} required />
      <Input label="Subtitle" name="subtitle" value={formData.subtitle} onChange={handleChange} />
      <Input label="Image URL" name="image_url" value={formData.image_url} onChange={handleChange} required />
      
      <div className="flex gap-4">
        <div className="w-1/2">
          <label className="block text-xs font-bold text-gray-700 mb-1">Redirect Type</label>
          <select name="redirect_type" value={formData.redirect_type} onChange={handleChange} className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white text-sm">
            <option value="url">URL</option>
            <option value="category">Category</option>
            <option value="service">Service</option>
            <option value="none">None</option>
          </select>
        </div>
        <div className="w-1/2">
          <Input label="Redirect URL / ID" name="redirect_url" value={formData.redirect_url} onChange={handleChange} />
        </div>
      </div>
      
      <div className="flex gap-4">
        <div className="w-1/3">
          <Input label="Button Text" name="button_text" value={formData.button_text} onChange={handleChange} />
        </div>
        <div className="w-1/3">
          <Input label="Display Order" type="number" name="display_order" value={formData.display_order} onChange={handleChange} required />
        </div>
        <div className="w-1/3">
          <label className="block text-xs font-bold text-gray-700 mb-1">Status</label>
          <select name="status" value={formData.status} onChange={handleChange} className="w-full h-10 px-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white text-sm">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t">
        <Button variant="outline" type="button" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" type="submit" icon={CheckCircle2}>Save Banner</Button>
      </div>
    </form>
  );
};
export default BannerForm;
