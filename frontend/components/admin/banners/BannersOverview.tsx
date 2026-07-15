"use client";
import React, { useState, useEffect } from 'react';
import { Plus, Image as ImageIcon, Users, Briefcase, Search, Filter, ChevronDown, Bell, ShieldCheck, ArrowRight } from 'lucide-react';
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
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);
  const [defaultRole, setDefaultRole] = useState<'user' | 'provider'>('user');
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('user');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

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

  // Filter & Sort Logic
  const filteredBanners = banners.filter(b => {
    const matchesSearch = 
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.subtitle && b.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (b.redirect_url && b.redirect_url.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesAudience = 
      audienceFilter === 'all' ? true :
      audienceFilter === 'provider' ? b.role === 'provider' :
      b.role !== 'provider';

    const matchesStatus = 
      statusFilter === 'all' ? true :
      b.status === statusFilter;

    return matchesSearch && matchesAudience && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    }
    if (sortBy === 'order_asc') {
      return a.display_order - b.display_order;
    }
    if (sortBy === 'order_desc') {
      return b.display_order - a.display_order;
    }
    return 0;
  });

  const userBanners = filteredBanners.filter(b => b.role !== 'provider');
  const providerBanners = filteredBanners.filter(b => b.role === 'provider');
  const totalUserCount = banners.filter(b => b.role !== 'provider').length;
  const totalProviderCount = banners.filter(b => b.role === 'provider').length;

  return (
    <div className="space-y-8 pb-16">
      {/* ── Top Header Section ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Banners Management</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Create and manage promotional banners for users and service providers.</p>
        </div>

        <div className="relative isolate">
          <button 
            type="button"
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} /> Create Banner <ChevronDown size={14} className={`transition-transform duration-200 ${isCreateMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                type="button"
                onClick={() => { setIsCreateMenuOpen(false); setEditingBanner(null); setDefaultRole('user'); setIsFormOpen(true); }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-blue-50 text-xs font-bold text-gray-700 hover:text-blue-600 flex items-center gap-2.5 transition-colors"
              >
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Users size={14} /></div>
                <div>
                  <div className="font-bold">Add User Banner</div>
                  <div className="text-[10px] text-gray-400 font-normal">Customer landing page</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setIsCreateMenuOpen(false); setEditingBanner(null); setDefaultRole('provider'); setIsFormOpen(true); }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-purple-50 text-xs font-bold text-gray-700 hover:text-purple-600 flex items-center gap-2.5 transition-colors mt-1"
              >
                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Briefcase size={14} /></div>
                <div>
                  <div className="font-bold">Add Provider Banner</div>
                  <div className="text-[10px] text-gray-400 font-normal">Partner portal & dashboard</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Audience Tabs Counters ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <button 
          type="button"
          onClick={() => setAudienceFilter('user')}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-2xs cursor-pointer ${
            audienceFilter === 'user' 
              ? 'border-2 border-blue-600 text-blue-600 bg-blue-50/40 shadow-sm' 
              : 'border border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50/50'
          }`}
        >
          <div className="p-2 bg-blue-600 text-white rounded-xl"><Users size={16} /></div>
          <span>User Banners</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-black">{totalUserCount}</span>
        </button>

        <button 
          type="button"
          onClick={() => setAudienceFilter('provider')}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-2xs cursor-pointer ${
            audienceFilter === 'provider' 
              ? 'border-2 border-purple-600 text-purple-600 bg-purple-50/40 shadow-sm' 
              : 'border border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50/50'
          }`}
        >
          <div className="p-2 bg-purple-600 text-white rounded-xl"><Briefcase size={16} /></div>
          <span>Provider Banners</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-black">{totalProviderCount}</span>
        </button>

        <button 
          type="button"
          onClick={() => setAudienceFilter('all')}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-2xs cursor-pointer ${
            audienceFilter === 'all' 
              ? 'border-2 border-gray-800 text-gray-900 bg-gray-100 shadow-sm' 
              : 'border border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50/50'
          }`}
        >
          <span>Show All</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 text-xs font-black">{banners.length}</span>
        </button>
      </div>

      {/* ── Search and Filter Bar ──────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 py-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search banners.." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200/80 text-sm focus:outline-none focus:border-blue-500 font-medium text-gray-800 placeholder-gray-400 bg-white shadow-2xs transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
          <div className="flex flex-col min-w-[125px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Audience</span>
            <select 
              value={audienceFilter} 
              onChange={(e) => setAudienceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="user">User</option>
              <option value="provider">Provider</option>
            </select>
          </div>

          <div className="flex flex-col min-w-[125px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Status</span>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex flex-col min-w-[140px]">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Sort By</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200/80 text-xs font-bold text-gray-700 bg-white shadow-2xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="order_asc">Order: Low to High</option>
              <option value="order_desc">Order: High to Low</option>
            </select>
          </div>

          <div className="flex flex-col justify-end self-end">
            <button 
              type="button"
              onClick={() => { setSearchQuery(''); setAudienceFilter('all'); setStatusFilter('all'); setSortBy('newest'); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 font-bold text-xs text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-2xs h-[38px] cursor-pointer"
            >
              <Filter size={13} className="text-gray-500" /> Filters
            </button>
          </div>
        </div>
      </div>

      {/* ── User Banners Section Box ───────────────────────────────────── */}
      {(audienceFilter === 'all' || audienceFilter === 'user') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200/60">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-sm">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">User Banners</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Banners shown on user-facing pages (Homepage, Landing etc.)</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => { setEditingBanner(null); setDefaultRole('user'); setIsFormOpen(true); }}
              className="px-4 py-2.5 rounded-xl border border-blue-200 bg-white text-blue-600 hover:bg-blue-50 font-extrabold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" /> Add User Banner
            </button>
          </div>

          {userBanners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {userBanners.map(banner => (
                <BannerCard
                  key={banner._id}
                  banner={banner}
                  onEdit={(b) => { setEditingBanner(b); setIsFormOpen(true); }}
                  onDelete={(b) => setBannerToDelete(b)}
                  onPreview={(b) => setPreviewBanner(b)}
                  onToggle={(b) => handleToggle(b)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-14 bg-white/60 rounded-2xl border border-dashed border-gray-200 text-gray-400">
              <ImageIcon className="mx-auto h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm font-bold text-gray-600">No user banners found</p>
              <p className="text-xs text-gray-400 mt-1">Create a promotional banner to display on the main customer landing page.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Provider Banners Section Box ───────────────────────────────── */}
      {(audienceFilter === 'all' || audienceFilter === 'provider') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-200/60">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-600 rounded-2xl text-white shadow-sm">
                <Briefcase size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">Provider Banners</h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Banners shown on provider dashboard and partner portal</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={() => { setEditingBanner(null); setDefaultRole('provider'); setIsFormOpen(true); }}
              className="px-4 py-2.5 rounded-xl border border-purple-200 bg-white text-purple-600 hover:bg-purple-50 font-extrabold text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={14} className="stroke-[3]" /> Add Provider Banner
            </button>
          </div>

          {providerBanners.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {providerBanners.map(banner => (
                <BannerCard
                  key={banner._id}
                  banner={banner}
                  onEdit={(b) => { setEditingBanner(b); setIsFormOpen(true); }}
                  onDelete={(b) => setBannerToDelete(b)}
                  onPreview={(b) => setPreviewBanner(b)}
                  onToggle={(b) => handleToggle(b)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-14 bg-white/60 rounded-2xl border border-dashed border-gray-200 text-gray-400">
              <ImageIcon className="mx-auto h-12 w-12 opacity-30 mb-3" />
              <p className="text-sm font-bold text-gray-600">No provider banners found</p>
              <p className="text-xs text-gray-400 mt-1">Create a partner offer to display inside the provider onboarding & dashboard.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Form Modal ──────────────────────────────────────── */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingBanner ? "Edit Banner" : "New Banner"}>
        <BannerForm 
          key={editingBanner ? editingBanner._id : `new-${defaultRole}`}
          initialData={editingBanner || { role: defaultRole }} 
          onSubmit={handleFormSubmit} 
          onCancel={() => setIsFormOpen(false)} 
        />
      </Modal>

      {/* ── Live Preview Modal ─────────────────────────────────────────── */}
      {previewBanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
                  previewBanner.role === 'provider' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  Live Preview • {previewBanner.role === 'provider' ? 'Partner Portal' : 'Customer Homepage'}
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 mt-1.5">{previewBanner.title}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Simulated Live Render Container */}
            <div className="relative w-full h-[260px] sm:h-[320px] rounded-[2rem] overflow-hidden bg-[#1D2B83] shadow-xl p-6 sm:p-10 text-white flex items-center justify-between isolate">
              <img 
                src={previewBanner.image_url} 
                alt={previewBanner.title}
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent -z-10" />

              <div className="max-w-md space-y-3 sm:space-y-4 z-10">
                <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-md">
                  <ShieldCheck className="h-4 w-4 text-indigo-200" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                    {previewBanner.role === 'provider' ? 'Exclusive Provider Reward' : 'Limited Time Offer'}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight drop-shadow-md">
                  {previewBanner.title}
                </h2>

                {previewBanner.subtitle && (
                  <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed font-medium">
                    {previewBanner.subtitle}
                  </p>
                )}

                {previewBanner.button_text && (
                  <div className="pt-2">
                    <button type="button" className="bg-white text-[#1D2B83] text-xs sm:text-sm font-extrabold uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg flex items-center gap-2">
                      {previewBanner.button_text} <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      <ConfirmationModal
        isOpen={!!bannerToDelete}
        onClose={() => setBannerToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Banner"
        message="Are you sure you want to delete this banner? It will be removed instantly."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}


