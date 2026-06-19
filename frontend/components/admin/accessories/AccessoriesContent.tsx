"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Pencil, Trash2, RefreshCw, ChevronLeft,
  ChevronRight, Wrench, SlidersHorizontal, X, Tag
} from 'lucide-react';
import Table from '../common/Table';
import Button from '../common/Button';
import AccessoryModal from './AccessoryModal';
import ConfirmationModal from '../common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '@/config/api';

const AccessoriesContent: React.FC = () => {
  const [accessories, setAccessories] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAccessory, setSelectedAccessory] = useState<any>(null);
  const [accessoryToDelete, setAccessoryToDelete] = useState<any>(null);
  const [accessoryChangingStatus, setAccessoryChangingStatus] = useState<any>(null);

  // ── Filter state ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // ── Pagination ─────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6;

  // close filter panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchAccessories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_URL}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchAccessories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/accessories`);
      setAccessories(response.data);
    } catch (error) {
      console.error('Error fetching accessories:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtering logic ────────────────────────────────────────────────
  const filteredAccessories = accessories.filter(acc => {
    // Category filter
    if (activeCategoryId !== 'all') {
      const accCatId = acc.category?._id || acc.category;
      if (accCatId !== activeCategoryId) return false;
    }
    // Live search: name, category name, description
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const inTitle    = (acc.title || '').toLowerCase().includes(q);
      const inCat      = (acc.category?.category_name || '').toLowerCase().includes(q);
      const inDesc     = (acc.description || '').toLowerCase().includes(q);
      if (!inTitle && !inCat && !inDesc) return false;
    }
    return true;
  });

  // how many accessories in each category (for badge counts)
  const countByCategory = (catId: string) =>
    accessories.filter(acc => {
      const id = acc.category?._id || acc.category;
      return id === catId;
    }).length;

  const totalPages = Math.ceil(filteredAccessories.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentAccessories = filteredAccessories.slice(indexOfFirstRow, indexOfLastRow);

  const handlePrev = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const handleNext = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };

  // reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeCategoryId]);

  const handleOpenAdd = () => { setSelectedAccessory(null); setIsModalOpen(true); };
  const handleOpenEdit = (acc: any) => { setSelectedAccessory(acc); setIsModalOpen(true); };

  // ── Save (batch-aware) ─────────────────────────────────────────────
  const pendingSaves = useRef(0);
  const handleSave = async (accessoryData: any) => {
    pendingSaves.current += 1;
    try {
      if (selectedAccessory) {
        await axios.put(`${API_URL}/accessories/${selectedAccessory._id}`, accessoryData);
      } else {
        await axios.post(`${API_URL}/accessories`, accessoryData);
      }
    } catch (error) {
      console.error('Error saving accessory:', error);
      alert('Failed to save accessory. Please check your connection or permissions.');
    } finally {
      pendingSaves.current -= 1;
      if (pendingSaves.current === 0) fetchAccessories();
    }
  };

  const handleStatusToggle = async () => {
    if (!accessoryChangingStatus) return;
    try {
      const newStatus = accessoryChangingStatus.status === 'active' ? 'inactive' : 'active';
      await axios.put(`${API_URL}/accessories/${accessoryChangingStatus._id}`, {
        ...accessoryChangingStatus,
        status: newStatus,
      });
      fetchAccessories();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setAccessoryChangingStatus(null);
    }
  };

  const handleDelete = async () => {
    if (!accessoryToDelete) return;
    try {
      await axios.delete(`${API_URL}/accessories/${accessoryToDelete._id}`);
      fetchAccessories();
    } catch (error) {
      console.error('Error deleting accessory:', error);
    } finally {
      setAccessoryToDelete(null);
    }
  };

  const hasActiveFilter = activeCategoryId !== 'all';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Provider <span className="text-blue-600">Accessories</span>
          </h1>
          <p className="text-[11px] text-gray-400 font-semibold mt-1 tracking-wide">
            {accessories.length} total · {filteredAccessories.length} shown
          </p>
        </div>
      </div>

      {/* ── Search + Filter bar ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Live Search */}
          <div className="relative w-full max-w-md group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by name, category, description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-10 py-3 bg-white/70 border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all shadow-sm placeholder:font-normal"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter button */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setFilterPanelOpen(prev => !prev)}
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-[11px] font-black tracking-wider transition-all shadow-sm ${
                  hasActiveFilter
                    ? 'bg-blue-600 text-white border-blue-600 shadow-blue-200'
                    : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filter
                {hasActiveFilter && (
                  <span className="w-4 h-4 bg-white/30 rounded-full text-[9px] flex items-center justify-center font-black">
                    1
                  </span>
                )}
              </button>

              {/* Filter dropdown panel */}
              <AnimatePresence>
                {filterPanelOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase flex items-center gap-1.5">
                        <Tag size={11} className="text-blue-500" /> Category
                      </span>
                      {hasActiveFilter && (
                        <button
                          onClick={() => { setActiveCategoryId('all'); setFilterPanelOpen(false); }}
                          className="text-[10px] font-black text-red-400 hover:text-red-600 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {/* All */}
                      <CategoryFilterItem
                        label="All Categories"
                        count={accessories.length}
                        active={activeCategoryId === 'all'}
                        onClick={() => { setActiveCategoryId('all'); setFilterPanelOpen(false); }}
                      />
                      {/* Per category */}
                      {categories.map(cat => (
                        <CategoryFilterItem
                          key={cat._id}
                          label={cat.category_name}
                          count={countByCategory(cat._id)}
                          active={activeCategoryId === cat._id}
                          onClick={() => { setActiveCategoryId(cat._id); setFilterPanelOpen(false); }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Add Accessory */}
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenAdd}
              className="shadow-lg bg-blue-600 text-[11px] py-3 rounded-2xl px-5 whitespace-nowrap"
            >
              Add Accessory
            </Button>
          </div>
        </div>


      </div>

      {/* ── Table ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key="accessories"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          className="space-y-6"
        >
          <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden group min-h-[460px] flex flex-col">
            <div className="flex-1">
              <Table
                headers={['Accessory', 'Category', 'Price', 'Status', 'Actions']}
                className="relative z-10"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {loading ? (
                    <tr key="loading">
                      <td colSpan={5} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw size={24} className="text-blue-600 animate-spin" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Fetching Accessories...
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : currentAccessories.length > 0 ? (
                    currentAccessories.map((acc, i) => (
                      <motion.tr
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        key={acc._id || `acc-${i}`}
                        className="hover:bg-blue-50/20 transition-all group/row border-b border-gray-50 last:border-0 text-[11px]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm overflow-hidden flex-shrink-0">
                              {acc.image ? (
                                <img src={acc.image} alt={acc.title} className="w-full h-full object-cover" />
                              ) : (
                                <Wrench size={16} />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 capitalize tracking-tight text-[11px]">
                                {/* Highlight search match */}
                                <HighlightText text={acc.title} query={searchTerm} />
                              </p>
                              <p className="text-[10px] text-gray-500 line-clamp-1 max-w-[150px]">{acc.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg font-bold text-blue-600 text-[10px] uppercase tracking-tight">
                            <Tag size={9} />
                            <HighlightText text={acc.category?.category_name || '—'} query={searchTerm} />
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-blue-600 text-[11px]">₹{acc.price}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <button
                              onClick={() => setAccessoryChangingStatus(acc)}
                              className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 shadow-inner ${
                                acc.status === 'inactive' ? 'bg-red-500' : 'bg-green-500'
                              }`}
                              title={acc.status === 'inactive' ? 'Offline' : 'Online'}
                            >
                              <div
                                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 z-10 ${
                                  acc.status === 'inactive' ? 'translate-x-0' : 'translate-x-6'
                                }`}
                              />
                              <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[7px] font-black uppercase tracking-tighter text-white pointer-events-none">
                                <span className={`transition-opacity duration-300 ${acc.status === 'inactive' ? 'opacity-0' : 'opacity-100'}`}>ON</span>
                                <span className={`transition-opacity duration-300 ${acc.status === 'inactive' ? 'opacity-100' : 'opacity-0'}`}>OFF</span>
                              </div>
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(acc)}
                              className="p-1 px-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100 active:scale-95"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => setAccessoryToDelete(acc)}
                              className="p-1 px-3 text-red-600 hover:bg-red-50 rounded-lg transition-all border border-transparent hover:border-red-100 active:scale-95"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr key="empty">
                      <td colSpan={5} className="px-6 py-32 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-4 py-10 opacity-60">
                          <Wrench size={48} strokeWidth={1} />
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                            No accessories found
                          </p>
                          {(searchTerm || hasActiveFilter) && (
                            <button
                              onClick={() => { setSearchTerm(''); setActiveCategoryId('all'); }}
                              className="text-[10px] font-black text-blue-500 hover:text-blue-700 underline underline-offset-2 transition-colors"
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Table>
            </div>

            {/* ── Pagination ── */}
            <div className="p-5 border-t border-white/20 flex flex-col items-center gap-6 bg-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600 shadow-blue-600/20'
                          : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Modals ── */}
      <AccessoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accessory={selectedAccessory}
        categories={categories}
        onSave={handleSave}
      />
      <ConfirmationModal
        isOpen={!!accessoryToDelete}
        onClose={() => setAccessoryToDelete(null)}
        onConfirm={handleDelete}
        title="Accessory Removal"
        message={`Are you sure you want to permanently delete "${accessoryToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Accessory"
        variant="danger"
      />
      <ConfirmationModal
        isOpen={!!accessoryChangingStatus}
        onClose={() => setAccessoryChangingStatus(null)}
        onConfirm={handleStatusToggle}
        title="Status Transition"
        message={`Are you sure you want to change the status of "${accessoryChangingStatus?.title}" to ${accessoryChangingStatus?.status === 'active' ? 'inactive' : 'active'}?`}
        confirmLabel="Update Status"
        cancelLabel="Maintain State"
        variant="info"
      />
    </div>
  );
};

// ─── Category chip pill ──────────────────────────────────────────────────────
const CategoryChip: React.FC<{
  label: string; count: number; active: boolean; onClick: () => void;
}> = ({ label, count, active, onClick }) => (
  <motion.button
    layout
    onClick={onClick}
    whileTap={{ scale: 0.95 }}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all border whitespace-nowrap ${
      active
        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
        : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200 hover:text-blue-600'
    }`}
  >
    {label}
    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${active ? 'bg-white/25' : 'bg-gray-100'}`}>
      {count}
    </span>
  </motion.button>
);

// ─── Category filter list item (inside dropdown) ─────────────────────────────
const CategoryFilterItem: React.FC<{
  label: string; count: number; active: boolean; onClick: () => void;
}> = ({ label, count, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
      active
        ? 'bg-blue-600 text-white'
        : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
    }`}
  >
    <span className="truncate">{label}</span>
    <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-black flex-shrink-0 ${
      active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
    }`}>
      {count}
    </span>
  </button>
);

// ─── Inline search highlight ─────────────────────────────────────────────────
const HighlightText: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query.trim() || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic font-black">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
};

export default AccessoriesContent;
