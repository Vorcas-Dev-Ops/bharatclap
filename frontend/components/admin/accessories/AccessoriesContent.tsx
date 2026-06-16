"use client";

import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Pencil, Trash2, Layers, RefreshCw, ChevronLeft, ChevronRight, Wrench
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6;

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

  const filteredAccessories = accessories.filter(acc => 
    (acc.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (acc.description && acc.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (acc.category?.category_name && acc.category.category_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredAccessories.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentAccessories = filteredAccessories.slice(indexOfFirstRow, indexOfLastRow);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenAdd = () => {
    setSelectedAccessory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: any) => {
    setSelectedAccessory(acc);
    setIsModalOpen(true);
  };

  const handleSave = async (accessoryData: any) => {
    try {
      if (selectedAccessory) {
        await axios.put(`${API_URL}/accessories/${selectedAccessory._id}`, accessoryData);
      } else {
        await axios.post(`${API_URL}/accessories`, accessoryData);
      }
      fetchAccessories();
    } catch (error) {
      console.error('Error saving accessory:', error);
      alert('Failed to save accessory. Please check your connection or permissions.');
    }
  };

  const handleStatusToggle = async () => {
    if (!accessoryChangingStatus) return;
    try {
      const newStatus = accessoryChangingStatus.status === 'active' ? 'inactive' : 'active';
      await axios.put(`${API_URL}/accessories/${accessoryChangingStatus._id}`, {
        ...accessoryChangingStatus,
        status: newStatus
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Provider <span className="text-blue-600">Accessories</span></h1>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search accessories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-100 rounded-2xl text-[11px] font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all shadow-sm"
          />
        </div>

        <Button 
          variant="primary" 
          size="sm" 
          icon={Plus} 
          onClick={handleOpenAdd}
          className="shadow-lg bg-blue-600 text-[11px] py-3.5 rounded-2xl px-6 whitespace-nowrap"
        >
          Add Accessory
        </Button>
      </div>

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
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fetching Accessories...</span>
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
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm overflow-hidden">
                              {acc.image ? (
                                <img src={acc.image} alt={acc.title} className="w-full h-full object-cover" />
                              ) : (
                                <Wrench size={16} />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-gray-900 capitalize tracking-tight text-[11px]">{acc.title}</p>
                              <p className="text-[10px] text-gray-500 line-clamp-1 max-w-[150px]">{acc.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-gray-700 text-[10px] uppercase tracking-tight">{acc.category?.category_name || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-blue-600 text-[11px]">₹{acc.price}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <button
                              onClick={() => setAccessoryChangingStatus(acc)}
                              className={`relative w-12 h-6 flex items-center p-0.5 rounded-full transition-all duration-300 shadow-inner group/toggle ${acc.status === 'inactive' ? 'bg-red-600' : 'bg-green-600'}`}
                              title={acc.status === 'inactive' ? 'Offline' : 'Online'}
                            >
                              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 z-10 ${acc.status === 'inactive' ? 'translate-x-0' : 'translate-x-6'}`} />
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
                          <p className="text-[10px] font-black uppercase tracking-[0.2em]">No accessories found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </Table>
            </div>

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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[32px] h-8 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${currentPage === page
                        ? "bg-blue-600 text-white border-blue-600 shadow-blue-600/20"
                        : "bg-white text-gray-500 border-gray-100 hover:border-blue-200 hover:bg-blue-50"
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

export default AccessoriesContent;
