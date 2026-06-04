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
  MapIcon
} from "lucide-react";
import { API_URL } from "@/config/api";
import { Button, Input, Form, message } from "antd";
import axios from 'axios';

interface LocationObject {
  _id: string;
  name: string;
}

interface AddressObject {
  _id: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  is_default: boolean;
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string, id: string) => void;
}

const LocationModal: React.FC<LocationModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [activeTab, setActiveTab] = useState<"cities" | "addresses">("cities");
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

  const fetchCities = async () => {
    try {
      setLoadingCities(true);
      const response = await axios.get(`${API_URL}/locations`);
      const data = response.data;
      if (Array.isArray(data)) {
        const cityList = data
          .filter((l: any) => l.type === 'city' && l.status === 'active')
          .map((l: any) => ({ _id: l._id, name: l.name }));
        setCities(cityList);
      }
    } catch (err: any) {
      console.error("Failed to fetch cities", err.message || err);
    } finally {
      setLoadingCities(false);
    }
  };

  const fetchAddresses = async (token: string) => {
    try {
      setLoadingAddresses(true);
      const response = await axios.get(`${API_URL}/addresses`, {
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
      }
    } finally {
      setLoadingAddresses(false);
    }
  };

  const [messageApi, contextHolder] = message.useMessage();

  const handleAddAddress = async (values: any) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await axios.post(`${API_URL}/addresses`, 
        { ...values, is_default: addresses.length === 0 },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      messageApi.success("Address added successfully");
      setShowAddForm(false);
      form.resetFields();
      fetchAddresses(token);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || "Failed to add address";
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

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          const addr = data.address;
          const cityName = addr.city || addr.town || addr.village || addr.state_district || "Unknown Location";
          const state = addr.state || "";
          const pincode = addr.postcode || "";
          const addressLine = [addr.road, addr.suburb, addr.neighbourhood].filter(Boolean).join(", ") || addr.display_name;

          if (isLoggedIn) {
            const token = localStorage.getItem("token");
            await axios.post(`${API_URL}/addresses`, {
                address_line: addressLine,
                city: cityName,
                state: state,
                pincode: pincode,
                is_default: addresses.length === 0,
                coordinates: {
                  type: 'Point',
                  coordinates: [longitude, latitude]
                }
              }, {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            });
            fetchAddresses(token!);
          }
          
          const matchedCity = cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
          if (matchedCity) {
            onSelect(matchedCity.name, matchedCity._id);
          } else {
            onSelect(cityName, "custom");
          }
          onClose();
          messageApi.success(`Located: ${cityName}`);
        } catch (err) {
          setError("Failed to fetch city name");
          messageApi.error("Failed to detect location details");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setError("Permission denied or location unavailable");
        setIsLocating(false);
      }
    );
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

                {isLoggedIn && (
                  <div className="flex p-1 bg-slate-100 rounded-2xl">
                    <button
                      onClick={() => { setActiveTab("cities"); setShowAddForm(false); }}
                      className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                        activeTab === "cities" ? "bg-white text-[#1D2B83] shadow-sm" : "text-slate-400"
                      }`}
                    >
                      Cities
                    </button>
                    <button
                      onClick={() => { setActiveTab("addresses"); setShowAddForm(false); }}
                      className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
                        activeTab === "addresses" ? "bg-white text-[#1D2B83] shadow-sm" : "text-slate-400"
                      }`}
                    >
                      My Addresses
                    </button>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                <div className={activeTab === "cities" ? "block space-y-6" : "hidden"}>
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#1D2B83] transition-colors" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search city e.g. Bengaluru"
                        className="w-full h-14 pl-12 pr-4 bg-slate-50 border border-transparent focus:border-[#1D2B83]/20 focus:bg-white rounded-2xl outline-none transition-all text-slate-700 font-medium"
                      />
                    </div>

                    <button
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-[#1D2B83]/30 hover:bg-slate-50 transition-all group"
                    >
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#1D2B83]">
                        {isLocating ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Navigation className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-bold text-slate-800 text-sm">
                          Use my current location
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                          Detect via browser
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1D2B83]" />
                    </button>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">
                        Available Cities
                      </h3>
                      {loadingCities ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm font-medium p-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading cities...
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {filteredCities.map((city) => (
                            <button
                              key={city._id}
                              onClick={() => onSelect(city.name, city._id)}
                              className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-[#1D2B83]/30 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all text-sm font-bold text-left"
                            >
                              <MapPin className="w-4 h-4 text-slate-300" />
                              {city.name}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                </div>

                <div className={activeTab === "addresses" ? "block space-y-6" : "hidden"}>
                  {/* Form is always rendered (never conditionally removed) to keep it connected to the useForm instance */}
                    <div className={showAddForm ? 'block' : 'hidden'}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-slate-50 rounded-[24px] border border-slate-100"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-sm font-black uppercase tracking-widest text-slate-800">Add New Address</h4>
                          <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <Form form={form} layout="vertical" onFinish={handleAddAddress} requiredMark={false}>
                          <Form.Item name="address_line" rules={[{ required: true, message: 'Required' }]}>
                            <Input placeholder="Flat, House no., Building, Company, Apartment" className="h-12 rounded-xl" />
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
                            Save Address
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
                                <button
                                  key={addr._id}
                                  onClick={() => onSelect(`${addr.address_line}, ${addr.city}`, addr._id)}
                                  className="w-full flex items-start gap-4 p-4 rounded-2xl border border-slate-100 hover:border-[#1D2B83]/30 hover:bg-slate-50 transition-all text-left group"
                                >
                                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-[#1D2B83]/10 group-hover:text-[#1D2B83] transition-colors">
                                    <Home className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-slate-800 text-sm">
                                        {addr.city}
                                      </p>
                                      {addr.is_default && (
                                        <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">Default</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-0.5">
                                      {addr.address_line}, {addr.landmark && `${addr.landmark}, `} {addr.city}, {addr.state} - {addr.pincode}
                                    </p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-slate-300 mt-3" />
                                </button>
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
                  {activeTab === "cities" ? "Select a city to explore" : "Select an address for service"}
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
