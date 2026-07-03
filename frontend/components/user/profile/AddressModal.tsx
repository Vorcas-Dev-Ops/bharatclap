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
  ChevronLeft,
  Loader2,
  Navigation,
  Star,
} from "lucide-react";
import { API_URL, apiClient } from "@/config/api";
import { Button, Input, Form, Select, message, Popconfirm } from "antd";
import { reverseGeocode } from "@/utils/geocode";
import dynamic from "next/dynamic";

const InteractiveMapPicker = dynamic(
  () => import("@/components/admin/location/InteractiveMapPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-64 bg-slate-50 animate-pulse rounded-[2rem] flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
        Initialising Map...
      </div>
    ),
  }
);

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

export default function AddressModal({ isOpen, onClose, onAddressSelect }: AddressModalProps) {
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingAddress, setEditingAddress] = useState<IAddress | null>(null);
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number }>({ lat: 12.9716, lng: 77.5946 });

  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

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
      setView("list");
      setEditingAddress(null);
    }
  }, [isOpen, fetchAddresses]);

  /* ─── Open form ─── */
  const openAddForm = () => {
    setEditingAddress(null);
    form.resetFields();
    form.setFieldsValue({ address_type: "Home" });
    setMapCoords({ lat: 12.9716, lng: 77.5946 });
    setView("form");
  };

  const openEditForm = (addr: IAddress) => {
    setEditingAddress(addr);
    form.setFieldsValue({
      address_type: addr.address_type || "Home",
      label: addr.label,
      house_no_building: addr.house_no_building,
      address_line_1: addr.address_line_1,
      address_line_2: addr.address_line_2,
      address_line_3: addr.address_line_3,
      area_locality: addr.area_locality,
      landmark: addr.landmark,
      city: addr.city,
      district: addr.district || addr.city,
      state: addr.state,
      pincode: addr.pincode,
      delivery_notes: addr.delivery_notes,
    });
    setMapCoords({
      lat: addr.latitude || 12.9716,
      lng: addr.longitude || 77.5946,
    });
    setView("form");
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
      fetchAddresses();
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
      if (onAddressSelect) onAddressSelect({ ...addr, is_default: true });
    } catch {
      messageApi.error("Failed to set default");
    }
  };

  /* ─── Pincode auto-fill ─── */
  const resolvePincode = async (pincode: string) => {
    if (!pincode || pincode.length !== 6) return;
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await res.json();
      if (data?.[0]?.Status === "Success" && data[0].PostOffice?.length > 0) {
        const info = data[0].PostOffice[0];
        form.setFieldsValue({
          city: info.District || info.Region || info.Circle,
          state: info.State,
        });
      }
    } catch {
      /* silently ignore */
    }
  };

  /* ─── GPS detect ─── */
  const handleGPS = () => {
    if (!navigator.geolocation) {
      messageApi.error("Geolocation not supported");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await reverseGeocode(latitude, longitude);

          form.setFieldsValue({ 
            house_no_building: result.house_name, 
            address_line_1: result.street, 
            area_locality: result.area, 
            city: result.city, 
            district: result.city,
            state: result.state, 
            country: "India",
            pincode: result.pincode 
          });
          setMapCoords({ lat: latitude, lng: longitude });
          messageApi.success("Location detected! Please review and save.");
        } catch {
          messageApi.error("Could not detect address details");
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        messageApi.error("Location permission denied or unavailable");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ─── Save ─── */
  const handleSave = async (values: any) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setSaving(true);
      const payload = {
        ...values,
        latitude: mapCoords.lat,
        longitude: mapCoords.lng,
      };

      const config = { headers: { Authorization: `Bearer ${token}` } };

      const res = editingAddress
        ? await apiClient.put(`${API_URL}/addresses/${editingAddress._id}`, payload, config)
        : await apiClient.post(`${API_URL}/addresses`, payload, config);

      messageApi.success(editingAddress ? "Address updated" : "Address saved");
      await fetchAddresses();
      setView("list");

      if (onAddressSelect) onAddressSelect(res.data);
    } catch (err: any) {
      messageApi.error(err.response?.data?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render ─── */
  return (
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
              <div className="flex items-center gap-3">
                {view === "form" && (
                  <button
                    onClick={() => { setView("list"); setEditingAddress(null); }}
                    className="p-2 -ml-1 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h2 className="text-xl font-black text-slate-800">
                    {view === "list" ? "My Addresses" : editingAddress ? "Edit Address" : "Add New Address"}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                    {view === "list" ? "Manage your service locations" : "Fill in address details"}
                  </p>
                </div>
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
              <AnimatePresence mode="wait">
                {/* ════ LIST VIEW ════ */}
                {view === "list" ? (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }}
                    className="space-y-4"
                  >
                    {/* Quick actions */}
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

                    {/* Address list */}
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
                                  <span className="text-sm font-black text-slate-800">{addr.address_type === "Other" && addr.label ? addr.label : addr.address_type}</span>
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
                  </motion.div>
                ) : (
                  /* ════ FORM VIEW ════ */
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                  >
                    <Form
                      form={form}
                      layout="vertical"
                      onFinish={handleSave}
                      requiredMark={false}
                      className="space-y-1"
                    >
                      {/* ── GPS Button (inside form) ── */}
                      <button
                        type="button"
                        onClick={handleGPS}
                        disabled={isLocating}
                        className="w-full flex items-center justify-center gap-3 py-3.5 mb-4 rounded-[1.25rem] bg-gradient-to-r from-[#1D2B83] to-[#3949c8] text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-blue-900/10 transition-all disabled:opacity-60"
                      >
                        {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                        {isLocating ? "Detecting your location..." : "Auto-fill with GPS"}
                      </button>

                      {/* ── Address Label ── */}
                      <Form.Item
                        label={<FieldLabel>Address Type *</FieldLabel>}
                        name="address_type"
                        rules={[{ required: true }]}
                      >
                        <Select
                          size="large"
                          className="rounded-2xl"
                          options={[
                            { value: "Home", label: "🏠  Home" },
                            { value: "Work", label: "💼  Work" },
                            { value: "Other", label: "📌  Other" },
                          ]}
                        />
                      </Form.Item>

                      {/* Custom Label (only if Other) */}
                      <Form.Item
                        noStyle
                        shouldUpdate={(prev, current) => prev.address_type !== current.address_type}
                      >
                        {({ getFieldValue }) =>
                          getFieldValue("address_type") === "Other" ? (
                            <Form.Item
                              label={<FieldLabel>Custom Label</FieldLabel>}
                              name="label"
                              className="!mb-4"
                            >
                              <Input
                                placeholder="e.g. Mom's House, Gym"
                                size="large"
                                className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                              />
                            </Form.Item>
                          ) : null
                        }
                      </Form.Item>

                      {/* ── Map Picker ── */}
                      <div className="mb-4">
                        <FieldLabel>Pin Location on Map *</FieldLabel>
                        <p className="text-[10px] text-slate-400 mb-2">Click map or search to pin your exact location</p>
                        <InteractiveMapPicker
                          latitude={mapCoords.lat}
                          longitude={mapCoords.lng}
                          onLocationPicked={(data) => {
                            setMapCoords({ lat: data.latitude, lng: data.longitude });
                            if (data.pincode) {
                              form.setFieldsValue({ pincode: data.pincode });
                              resolvePincode(data.pincode);
                            }
                          }}
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          📍 Pinned: {mapCoords.lat.toFixed(5)}, {mapCoords.lng.toFixed(5)}
                        </p>
                      </div>

                      <div className="bg-white rounded-[1.5rem] p-5 border border-slate-100 space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Address Details</p>

                        {/* House / Flat */}
                        <Form.Item
                          label={<FieldLabel>House / Building No. *</FieldLabel>}
                          name="house_no_building"
                          rules={[{ required: true, message: "Required" }]}
                          className="!mb-0"
                        >
                          <Input
                            placeholder="e.g. Flat 402, Green Residency"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* Address Line 1 */}
                        <Form.Item
                          label={<FieldLabel>Address Line 1 *</FieldLabel>}
                          name="address_line_1"
                          rules={[{ required: true, message: "Required" }]}
                          className="!mb-0"
                        >
                          <Input
                            placeholder="e.g. Street name, Society"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* Address Line 2 */}
                        <Form.Item
                          label={<FieldLabel>Address Line 2</FieldLabel>}
                          name="address_line_2"
                          className="!mb-0"
                        >
                          <Input
                            placeholder="Tower A, etc. (Optional)"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* Address Line 3 */}
                        <Form.Item
                          label={<FieldLabel>Address Line 3</FieldLabel>}
                          name="address_line_3"
                          className="!mb-0"
                        >
                          <Input
                            placeholder="Floor, etc. (Optional)"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* Area */}
                        <Form.Item
                          label={<FieldLabel>Area / Locality *</FieldLabel>}
                          name="area_locality"
                          rules={[{ required: true, message: "Required" }]}
                          className="!mb-0"
                        >
                          <Input
                            placeholder="e.g. MG Road, Kothaguda"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* Landmark */}
                        <Form.Item
                          label={<FieldLabel>Landmark</FieldLabel>}
                          name="landmark"
                          className="!mb-0"
                        >
                          <Input
                            placeholder="Near Metro Station (Optional)"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>

                        {/* City + District */}
                        <div className="grid grid-cols-2 gap-3">
                          <Form.Item
                            label={<FieldLabel>City *</FieldLabel>}
                            name="city"
                            rules={[{ required: true, message: "Required" }]}
                            className="!mb-0"
                          >
                            <Input
                              placeholder="City"
                              size="large"
                              className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                            />
                          </Form.Item>

                          <Form.Item
                            label={<FieldLabel>District *</FieldLabel>}
                            name="district"
                            rules={[{ required: true, message: "Required" }]}
                            className="!mb-0"
                          >
                            <Input
                              placeholder="District"
                              size="large"
                              className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                            />
                          </Form.Item>
                        </div>

                        {/* State */}
                        <div className="grid grid-cols-1 gap-3">
                          <Form.Item
                            label={<FieldLabel>State *</FieldLabel>}
                            name="state"
                            rules={[{ required: true, message: "Required" }]}
                            className="!mb-0"
                          >
                            <Input
                              placeholder="State"
                              size="large"
                              className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                            />
                          </Form.Item>
                        </div>

                        {/* Pincode */}
                        <Form.Item
                          label={<FieldLabel>Pincode *</FieldLabel>}
                          name="pincode"
                          rules={[{ required: true, message: "Required" }, { pattern: /^\d{6}$/, message: "Enter a valid 6-digit pincode" }]}
                          className="!mb-0"
                        >
                          <Input
                            placeholder="e.g. 686004"
                            size="large"
                            maxLength={6}
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                            onBlur={(e) => resolvePincode(e.target.value)}
                          />
                        </Form.Item>

                        {/* Delivery Notes */}
                        <Form.Item
                          label={<FieldLabel>Delivery Notes</FieldLabel>}
                          name="delivery_notes"
                          className="!mb-0"
                        >
                          <Input
                            placeholder="e.g. Ring bell twice"
                            size="large"
                            className="rounded-xl border-slate-200 focus:border-[#1D2B83]"
                          />
                        </Form.Item>
                      </div>

                      {/* Submit */}
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={saving}
                        size="large"
                        className="w-full !h-14 !bg-[#1D2B83] hover:!bg-blue-800 border-none !rounded-[1.25rem] font-black uppercase tracking-[0.15em] shadow-xl shadow-blue-900/20 mt-2"
                      >
                        {saving ? "Saving..." : editingAddress ? "Update Address" : "Save Address"}
                      </Button>
                    </Form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{children}</span>
);
