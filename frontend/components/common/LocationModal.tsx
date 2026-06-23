"use client";
// Force Turbopack Cache Invalidation


import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Navigation,
  MapPin,
  Search,
  ChevronRight,
  Loader2,
  Plus,
  Home,
  Briefcase,
  CheckCircle2,
  MapIcon,
  Pencil,
  Trash2
} from "lucide-react";
import { API_URL, apiClient } from "@/config/api";
import { Button, Input, Form, message } from "antd";
import { reverseGeocode } from "@/utils/geocode";

interface LocationObject {
  _id: string;
  name: string;
}

interface AddressObject {
  _id: string;
  address_line?: string;
  address_label?: string;
  house_name?: string;
  building_name?: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  is_default: boolean;
  // Extended fields used in the component
  house_name?: string;
  area?: string;
  address_label?: string;
  building_name?: string;
  street?: string;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string, id: string) => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState<"cities" | "addresses">("addresses");
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<LocationObject[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  const [addresses, setAddresses] = useState<AddressObject[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const validToken = token && token !== "null" && token !== "undefined" && token.trim() !== "";
    setIsLoggedIn(!!validToken);

    if (validToken) {
      fetchAddresses(token.trim());
    }
  }, [isOpen]);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async (retryCount = 0) => {
    try {
      setLoadingCities(true);
      const response = await apiClient.get(`${API_URL}/locations`);
      const data = response.data;
      if (Array.isArray(data)) {
        const cityList = data
          .filter((l: any) => l.type === 'city' && l.status === 'active')
          .map((l: any) => ({ _id: l._id, name: l.name }));
        setCities(cityList);
      }
    } catch (err: any) {
      console.error("Failed to fetch cities", err.message || err);
      if (retryCount < 1) {
        console.log("Retrying fetchCities...");
        await new Promise(r => setTimeout(r, 1000));
        return fetchCities(retryCount + 1);
      }
    } finally {
      setLoadingCities(false);
    }
  };

  const fetchAddresses = async (token: string, retryCount = 0) => {
    try {
      setLoadingAddresses(true);
      const response = await apiClient.get(`${API_URL}/addresses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = response.data;
      if (Array.isArray(data)) {
        setAddresses(data);
        if (data.length > 0) {
          setActiveTab("addresses");
        }
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setIsLoggedIn(false);
        setAddresses([]);
        window.location.reload();
      } else {
        console.error("Failed to fetch addresses", err.message || err);
        if (retryCount < 1) {
          console.log("Retrying fetchAddresses...");
          await new Promise(r => setTimeout(r, 1000));
          return fetchAddresses(token, retryCount + 1);
        }
      }
    } finally {
      setLoadingAddresses(false);
    }
  };

  const [messageApi, contextHolder] = message.useMessage();

  const handleSaveAddress = async (values: any) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      if (editingAddressId) {
        // Edit mode
        await apiClient.put(`${API_URL}/addresses/${editingAddressId}`,
          values,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
        messageApi.success("Address updated successfully");
        onSelect(values.city, editingAddressId);
      } else {
        // Add mode
        const response = await apiClient.post(`${API_URL}/addresses`,
          { ...values, is_default: addresses.length === 0 },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );
        messageApi.success("Address added successfully");
        const newAddr = response.data;
        if (newAddr && newAddr._id) {
          onSelect(newAddr.city, newAddr._id);
        } else {
          onSelect(values.city, "custom");
        }
      }

      setShowAddForm(false);
      setEditingAddressId(null);
      form.resetFields();
      onClose();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || `Failed to ${editingAddressId ? 'update' : 'add'} address`;
      messageApi.error(errorMsg);
    }
  };

  const handleEditClick = (addr: AddressObject) => {
    setEditingAddressId(addr._id);
    form.setFieldsValue({
      house_name: addr.house_name || addr.address_line,
      area: addr.area || addr.city,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      landmark: addr.landmark || ""
    });
    setShowAddForm(true);
  };

  const handleDeleteClick = async (addressId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await apiClient.delete(`${API_URL}/addresses/${addressId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      messageApi.success("Address removed successfully");
      fetchAddresses(token);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to remove address";
      messageApi.error(errorMsg);
    }
  };

  const filteredCities = cities.filter(city =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    // Use watchPosition to get a more accurate reading, then stop after first good fix
    let watchId: number | null = null;
    let resolved = false;

    const resolveLocation = async (position: GeolocationPosition) => {
      if (resolved) return;
      resolved = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      const { latitude, longitude, accuracy } = position.coords;
      console.log(`Detected coordinates: ${latitude}, ${longitude} (accuracy: ${accuracy}m)`);

      try {
        const result = await reverseGeocode(latitude, longitude);

        // The title shown in the navbar & modal header — prefer the most specific name
        // Priority: area/neighbourhood > road > city
        const displayTitle = result.area || result.street || result.house_name || result.city || "Your Location";

        // Save to user profile if logged in
        if (isLoggedIn) {
          try {
            const token = localStorage.getItem("token");
            if (token) {
              await apiClient.post(
                `${API_URL}/addresses`,
                {
                  address_label: "Other",
                  house_name: result.house_name || "Detected Location",
                  street: result.street || "",
                  area: result.area || result.city || "Unknown",
                  city: result.city || displayTitle,
                  state: result.state || "Unknown",
                  pincode: result.pincode || "000000",
                  is_default: addresses.length === 0,
                  coordinates: {
                    type: "Point",
                    coordinates: [longitude, latitude],
                  },
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                }
              );
              fetchAddresses(token);
            }
          } catch (saveErr) {
            console.error("Failed to save detected address to profile:", saveErr);
          }
        }

        // Match against known service cities (by city name)
        const matchedCity = cities.find(
          (c) => c.name.toLowerCase() === (result.city || "").toLowerCase()
        );

        if (matchedCity) {
          onSelect(displayTitle, matchedCity._id);
        } else {
          onSelect(displayTitle, "custom");
        }

        onClose();
        messageApi.success(`Location detected: ${displayTitle}`);
      } catch (err: any) {
        console.error("Reverse geocoding error:", err);
        setError(
          "Could not detect your address. Please try again or enter it manually."
        );
        messageApi.error(
          "Failed to detect location. Please retry or enter address manually."
        );
      } finally {
        setIsLocating(false);
      }
    };

    const handleError = (err: GeolocationPositionError) => {
      if (resolved) return;
      resolved = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      console.error("Geolocation error:", err);
      let errorMsg = "Permission denied or location unavailable";
      if (err.code === 1)
        errorMsg =
          "Location permission denied. Please enable location access in your browser.";
      if (err.code === 2)
        errorMsg =
          "Location unavailable. Please check your network or device settings.";
      if (err.code === 3)
        errorMsg = "Location request timed out. Please try again.";
      setError(errorMsg);
      messageApi.error(errorMsg);
      setIsLocating(false);
    };

    // watchPosition gives the first available fix immediately, then improves accuracy
    watchId = navigator.geolocation.watchPosition(resolveLocation, handleError, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });

    // Safety timeout: if watch never fires a position in 22s, stop and show error
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        setError("Location request timed out. Please try again.");
        messageApi.error("Location request timed out. Please try again.");
        setIsLocating(false);
      }
    }, 22000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {contextHolder}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />

          <div className="fixed inset-0 flex items-end sm:items-center justify-center pointer-events-none z-[201] p-0 sm:p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 100 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 100 }}
              className="bg-white pointer-events-auto w-full max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-50">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                      Select Location
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                      Find services available in your area
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-slate-50 transition-colors rounded-full"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 no-scrollbar">

                <div className={activeTab === "addresses" ? "block space-y-6" : "hidden"}>
                  {/* Form is always rendered (never conditionally removed) to keep it connected to the useForm instance */}
                  <div className={showAddForm ? 'block' : 'hidden'}>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-slate-50 rounded-[24px] border border-slate-100"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-slate-800">
                          {editingAddressId ? "Edit Address" : "Add New Address"}
                        </h4>
                        <button onClick={() => { setShowAddForm(false); setEditingAddressId(null); form.resetFields(); }} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <Form form={form} layout="vertical" onFinish={handleSaveAddress} requiredMark={false}>
                        <Form.Item name="house_name" rules={[{ required: true, message: 'Required' }]}>
                          <Input placeholder="Flat, House no., Building, Company, Apartment" className="h-12 rounded-xl" />
                        </Form.Item>
                        <Form.Item name="area" rules={[{ required: true, message: 'Required' }]}>
                          <Input placeholder="Area, Colony, Street, Sector, Village" className="h-12 rounded-xl" />
                        </Form.Item>
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item name="city" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="City" className="h-12 rounded-xl" />
                          </Form.Item>
                          <Form.Item name="state" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="State" className="h-12 rounded-xl" />
                          </Form.Item>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <Form.Item name="pincode" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="Pincode" className="h-12 rounded-xl" />
                          </Form.Item>
                          <Form.Item name="landmark">
                            <Input placeholder="Landmark (Optional)" className="h-12 rounded-xl" />
                          </Form.Item>
                        </div>
                        <Button
                          type="primary"
                          htmlType="submit"
                          className="w-full h-12 bg-[#1D2B83] border-none font-black uppercase tracking-widest rounded-xl mt-2"
                        >
                          {editingAddressId ? "Save Changes" : "Save Address"}
                        </Button>
                      </Form>
                    </motion.div>
                  </div>

                  <div className={showAddForm ? 'hidden' : 'block'}>
                    <>
                      <div className="grid grid-cols-1 gap-3">
                        <button
                          onClick={handleGetCurrentLocation}
                          disabled={isLocating}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all group"
                        >
                          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            {isLocating ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <Navigation className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-bold text-sm">
                              Use my current location
                            </p>
                            <p className="text-[10px] opacity-70 font-bold uppercase tracking-wide">
                              Detect live GPS coordinates
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-50" />
                        </button>

                        <button
                          onClick={() => setShowAddForm(true)}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#1D2B83]/30 hover:bg-slate-50 transition-all text-[#1D2B83] font-bold text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Enter Address Manually
                        </button>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                          Saved Addresses
                        </h3>
                        {loadingAddresses ? (
                          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium p-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading addresses...
                          </div>
                        ) : addresses.length > 0 ? (
                          <div className="space-y-3">
                            {addresses.map((addr) => (
                              <div
                                key={addr._id}
                                className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-[#1D2B83]/30 hover:bg-slate-50 transition-all group"
                              >
                                <div
                                  onClick={() => onSelect(addr.city, addr._id)}
                                  className="flex-1 flex items-start gap-4 cursor-pointer text-left min-w-0"
                                >
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${addr.address_label === 'Home' ? 'bg-violet-50 text-violet-600' : addr.address_label === 'Office' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600 group-hover:bg-[#1D2B83]/10 group-hover:text-[#1D2B83]'}`}>
                                    {addr.address_label === 'Home' ? <Home className="w-5 h-5" /> : addr.address_label === 'Office' ? <Briefcase className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-800 text-sm truncate">
                                        {addr.address_label || addr.city}
                                      </p>
                                      {addr.is_default && (
                                        <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex-shrink-0">Default</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                                      {addr.house_name || addr.address_line}
                                      {addr.building_name ? `, ${addr.building_name}` : ''}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                      {[addr.street, addr.area, addr.city, addr.pincode].filter(Boolean).join(', ')}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditClick(addr);
                                    }}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                    title="Edit Address"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(addr._id);
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                    title="Delete Address"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <MapIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-500">No saved addresses</p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">Add an address to see it here</p>
                          </div>
                        )}
                      </div>
                    </>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-slate-50/50 flex justify-center border-t border-gray-50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Select an address for service
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LocationModal;
