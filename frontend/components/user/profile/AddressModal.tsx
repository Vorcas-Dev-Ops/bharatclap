"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  Home,
  Briefcase,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  Navigation,
  Star,
} from "lucide-react";
import { API_URL, apiClient } from "@/config/api";
import { message, Popconfirm } from "antd";
import AddressFormModal from "./AddressFormModal";

export interface IAddress {
  _id: string;
  address_type: "Home" | "Work" | "Other";
  label?: string;
  house_no_building: string;
  address_line_1: string;
  address_line_2?: string;
  address_line_3?: string;
  area_locality: string;
  landmark?: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  delivery_notes?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  address_line?: string;
}

const LABEL_ICONS: Record<string, React.ReactNode> = {
  Home: <Home className="w-5 h-5" />,
  Work: <Briefcase className="w-5 h-5" />,
  Other: <MoreHorizontal className="w-5 h-5" />,
};

const LABEL_COLORS: Record<string, string> = {
  Home: "bg-violet-50 text-violet-600 border-violet-200",
  Work: "bg-sky-50 text-sky-600 border-sky-200",
  Other: "bg-amber-50 text-amber-600 border-amber-200",
};

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressSelect?: (address: IAddress) => void;
}

const MAX_ADDRESSES = 3;

export default function AddressModal({ isOpen, onClose, onAddressSelect }: AddressModalProps) {
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Controls the AddressFormModal sub-modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<IAddress | null>(null);

  const [messageApi, contextHolder] = message.useMessage();

  const atLimit = addresses.length >= MAX_ADDRESSES;

  /* ─── Fetch ─── */
  const fetchAddresses = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || token === "null" || token.trim() === "") return;
    try {
      setLoading(true);
      const res = await apiClient.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      setAddresses(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAddresses();
    }
  }, [isOpen, fetchAddresses]);

  /* ─── Open Add form ─── */
  const openAddForm = () => {
    setEditingAddress(null);
    setIsFormOpen(true);
  };

  /* ─── Open Edit form ─── */
  const openEditForm = (addr: IAddress) => {
    setEditingAddress(addr);
    setIsFormOpen(true);
  };

  /* ─── GPS detect ─── */
  const handleGPS = () => {
    if (!navigator.geolocation) {
      messageApi.error("Geolocation not supported");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsLocating(false);
        openAddForm(); // GPS will be triggered inside AddressFormModal via its own GPS button
      },
      () => {
        messageApi.error("Location permission denied or unavailable");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ─── Delete ─── */
  const handleDelete = async (id: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await apiClient.delete(`${API_URL}/addresses/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      messageApi.success("Address deleted");
      await fetchAddresses();
      window.dispatchEvent(new Event("addressChanged"));
    } catch {
      messageApi.error("Failed to delete address");
    }
  };

  /* ─── Set Default ─── */
  const handleSetDefault = async (addr: IAddress) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await apiClient.patch(`${API_URL}/addresses/${addr._id}/set-default`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAddresses();
      window.dispatchEvent(new Event("defaultAddressChanged"));
      if (onAddressSelect) onAddressSelect({ ...addr, is_default: true });
    } catch {
      messageApi.error("Failed to set default");
    }
  };

  /* ─── After form saved ─── */
  const handleFormSaved = (savedAddr: any) => {
    setIsFormOpen(false);
    setEditingAddress(null);
    fetchAddresses();
    if (onAddressSelect && savedAddr) onAddressSelect(savedAddr);
  };

  /* ─── Render ─── */
  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            {contextHolder}

            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
            />

            {/* Panel */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 24 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="relative w-full max-w-2xl bg-[#F8F9FC] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* ── Header ── */}
              <div className="bg-white px-8 py-5 flex items-center justify-between border-b border-slate-100 shrink-0">
                <div>
                  <h2 className="text-xl font-black text-slate-800">My Addresses</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                    {addresses.length} / {MAX_ADDRESSES} addresses saved
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 text-slate-400 bg-slate-50 hover:bg-slate-100 hover:text-slate-800 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── Content ── */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5">

                {/* ── Quick Actions or Limit Banner ── */}
                {atLimit ? (
                  <div className="flex items-center gap-3 p-4 rounded-[1.5rem] bg-amber-50 border border-amber-200">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-amber-800">Address limit reached</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        You can save up to {MAX_ADDRESSES} addresses. Delete one to add a new address.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { openAddForm(); setTimeout(handleGPS, 200); }}
                      disabled={isLocating}
                      className="flex items-center justify-center gap-3 py-4 rounded-[1.5rem] bg-[#1D2B83] text-white font-bold hover:bg-[#16226b] shadow-lg shadow-blue-900/10 transition-all disabled:opacity-70"
                    >
                      {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                      {isLocating ? "Locating..." : "Use My Location"}
                    </button>
                    <button
                      onClick={openAddForm}
                      className="flex items-center justify-center gap-3 py-4 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Add Manually
                    </button>
                  </div>
                )}

                {/* ── Address list ── */}
                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-[#1D2B83] animate-spin" />
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="text-center py-12 opacity-60">
                    <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-500">No saved addresses yet</p>
                    <p className="text-xs text-slate-400 mt-1">Add your first address above</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <motion.div
                        key={addr._id}
                        layout
                        className={`relative p-5 bg-white rounded-[1.75rem] border-2 transition-all cursor-pointer group ${
                          addr.is_default
                            ? "border-[#1D2B83] shadow-lg shadow-blue-900/5 ring-1 ring-[#1D2B83]/10"
                            : "border-transparent shadow-sm hover:border-slate-200 hover:shadow-md"
                        }`}
                        onClick={() => !addr.is_default && handleSetDefault(addr)}
                      >
                        {/* Default badge */}
                        {addr.is_default && (
                          <div className="absolute -top-3 left-5 px-2.5 py-0.5 bg-[#1D2B83] text-white text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Default
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          {/* Label icon */}
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 border transition-colors ${LABEL_COLORS[addr.address_type] || LABEL_COLORS.Other}`}>
                            {LABEL_ICONS[addr.address_type] || LABEL_ICONS.Other}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-black text-slate-800">
                                {addr.address_type === "Other" && addr.label ? addr.label : addr.address_type}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                              {addr.house_no_building}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {[addr.address_line_1, addr.address_line_2, addr.area_locality].filter(Boolean).join(", ")}
                            </p>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                              {addr.city}, {addr.state} – {addr.pincode}
                            </p>
                            {addr.landmark && (
                              <p className="text-[10px] text-slate-400 mt-0.5">📍 Near {addr.landmark}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!addr.is_default && (
                              <button
                                onClick={() => handleSetDefault(addr)}
                                className="hidden group-hover:flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-[#1D2B83] px-2 py-1.5 bg-slate-50 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <Star className="w-3 h-3" /> Default
                              </button>
                            )}
                            <button
                              onClick={() => openEditForm(addr)}
                              className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <Popconfirm
                              title="Delete this address?"
                              description="This action cannot be undone."
                              onConfirm={() => handleDelete(addr._id)}
                              okText="Delete"
                              cancelText="Cancel"
                              okButtonProps={{ danger: true }}
                            >
                              <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-xl transition-all">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </Popconfirm>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── AddressFormModal for Add / Edit ── */}
      <AddressFormModal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingAddress(null); }}
        onSaved={handleFormSaved}
        editAddress={editingAddress}
      />
    </>
  );
}
