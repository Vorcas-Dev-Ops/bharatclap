"use client";
import React, { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon } from 'lucide-react';
import BannerCard, { Banner } from './BannerCard';
import BannerForm from './BannerForm';
import Modal from '../common/Modal';
import Button from '../common/Button';
import ConfirmationModal from '../common/ConfirmationModal';
import axios from 'axios';
import { API_URL } from '@/config/api';

export default function BannersOverview() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

  const fetchBanners = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/banners/admin`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBanners(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleFormSubmit = async (data: any) => {
    try {
      const token = localStorage.getItem('token');
      if (editingBanner) {
        await axios.put(`${API_URL}/banners/${editingBanner._id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/banners`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsFormOpen(false);
      setEditingBanner(null);
      fetchBanners();
    } catch (err) {
      console.error(err);
      alert('Error saving banner');
    }
  };

  const handleDelete = async () => {
    if (!bannerToDelete) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/banners/${bannerToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBannerToDelete(null);
      fetchBanners();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (banner: Banner) => {
    try {
      const token = localStorage.getItem('token');
      const newStatus = banner.status === 'active' ? 'inactive' : 'active';
      await axios.put(`${API_URL}/banners/${banner._id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBanners();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black">Banners</h1>
        <Button variant="primary" onClick={() => { setEditingBanner(null); setIsFormOpen(true); }} icon={Plus}>Add Banner</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {banners.map(banner => (
          <BannerCard
            key={banner._id}
            banner={banner}
            onEdit={(b) => { setEditingBanner(b); setIsFormOpen(true); }}
            onDelete={(b) => setBannerToDelete(b)}
            onToggle={(b) => handleToggle(b)}
          />
        ))}
      </div>

      {banners.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <ImageIcon className="mx-auto h-12 w-12 opacity-50 mb-4" />
          <p>No banners found. Create one to get started.</p>
        </div>
      )}

      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingBanner ? "Edit Banner" : "New Banner"}>
        <BannerForm initialData={editingBanner} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
      </Modal>

      <ConfirmationModal
        isOpen={!!bannerToDelete}
        onClose={() => setBannerToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Banner"
        message="Are you sure you want to delete this banner? It will be removed from the landing page instantly."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
