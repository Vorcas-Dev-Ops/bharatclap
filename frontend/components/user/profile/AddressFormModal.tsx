"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MapPin, Search, Navigation, RefreshCw, Home, Briefcase, Map, Loader2, CheckCircle2,
} from "lucide-react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { reverseGeocode, GOOGLE_MAPS_API_KEY } from "@/utils/geocode";
import { API_URL, apiClient } from "@/config/api";
import { message } from "antd";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface AddressFormData {
  address_type: "Home" | "Work" | "Other";
  label: string;
  house_no_building: string;
  address_line_1: string;
  address_line_2: string;
  address_line_3: string;
  area_locality: string;
  landmark: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  delivery_notes: string;
  latitude: string;
  longitude: string;
  formatted_address: string;
  place_id: string;
  is_default: boolean;
}

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (address: any) => void;
  editAddress?: any | null;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */
const EMPTY: AddressFormData = {
  address_type: "Home",
  label: "",
  house_no_building: "",
  address_line_1: "",
  address_line_2: "",
  address_line_3: "",
  area_locality: "",
  landmark: "",
  city: "",
  district: "",
  state: "",
  country: "India",
  pincode: "",
  delivery_notes: "",
  latitude: "",
  longitude: "",
  formatted_address: "",
  place_id: "",
  is_default: false,
};

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const MAP_CONTAINER_STYLE = { width: "100%", height: "280px" };
const LIBRARIES: any[] = ["places"];

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function AddressFormModal({ isOpen, onClose, onSaved, editAddress }: AddressFormModalProps) {
  const [form, setForm] = useState<AddressFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressFormData, string>>>({});
  const [mapCenter, setMapCenter] = useState(INDIA_CENTER);
  const [markerPos, setMarkerPos] = useState(INDIA_CENTER);
  const [mapFilled, setMapFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const set = (k: keyof AddressFormData, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  /* ── Populate on open / edit ── */
  useEffect(() => {
    if (!isOpen) return;
    if (editAddress) {
      const lat = editAddress.latitude || INDIA_CENTER.lat;
      const lng = editAddress.longitude || INDIA_CENTER.lng;
      setForm({
        address_type: editAddress.address_type || "Home",
        label: editAddress.label || "",
        house_no_building: editAddress.house_no_building || "",
        address_line_1: editAddress.address_line_1 || "",
        address_line_2: editAddress.address_line_2 || "",
        address_line_3: editAddress.address_line_3 || "",
        area_locality: editAddress.area_locality || "",
        landmark: editAddress.landmark || "",
        city: editAddress.city || "",
        district: editAddress.district || editAddress.city || "",
        state: editAddress.state || "",
        country: editAddress.country || "India",
        pincode: editAddress.pincode || "",
        delivery_notes: editAddress.delivery_notes || "",
        latitude: lat.toString(),
        longitude: lng.toString(),
        formatted_address: editAddress.formatted_address || "",
        place_id: editAddress.place_id || "",
        is_default: editAddress.is_default || false,
      });
      setMapCenter({ lat, lng });
      setMarkerPos({ lat, lng });
      setMapFilled(true);
    } else {
      setForm(EMPTY);
      setMapCenter(INDIA_CENTER);
      setMarkerPos(INDIA_CENTER);
      setMapFilled(false);
    }
    setErrors({});
  }, [isOpen, editAddress]);

  /* ── Reverse geocode & fill form ── */
  const fillFromCoords = useCallback(async (lat: number, lng: number) => {
    try {
      setIsLocating(true);
      const res = await reverseGeocode(lat, lng);
      setForm(prev => ({
        ...prev,
        house_no_building: prev.house_no_building || res.house_no_building || "",
        address_line_1: prev.address_line_1 || res.address_line_1 || "",
        area_locality: res.area_locality || res.city || "",
        city: res.city || "",
        district: res.district || res.city || "",
        state: res.state || "",
        country: res.country || "India",
        pincode: res.pincode || "",
        formatted_address: res.formatted_address || "",
        place_id: res.place_id || "",
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
      setMarkerPos({ lat, lng });
      setMapCenter({ lat, lng });
      setMapFilled(true);
    } catch {
      messageApi.error("Could not get address from map location");
    } finally {
      setIsLocating(false);
    }
  }, [messageApi]);

  /* ── Map click ── */
  const onMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    await fillFromCoords(lat, lng);
  };

  /* ── Marker drag ── */
  const onMarkerDragEnd = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    await fillFromCoords(lat, lng);
  };

  /* ── Autocomplete place selected ── */
  const onPlaceChanged = async () => {
    const ac = autocompleteRef.current;
    if (!ac) return;
    const place = ac.getPlace();
    if (place?.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setMapCenter({ lat, lng });
      setMarkerPos({ lat, lng });
      await fillFromCoords(lat, lng);
    }
  };

  /* ── GPS auto-detect ── */
  const handleGPS = () => {
    if (!navigator.geolocation) { messageApi.error("Geolocation not supported"); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMapCenter({ lat, lng });
        setMarkerPos({ lat, lng });
        await fillFromCoords(lat, lng);
      },
      () => { messageApi.error("Location permission denied"); setIsLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  /* ── Validation ── */
  const validate = () => {
    const e: Partial<Record<keyof AddressFormData, string>> = {};
    if (!form.house_no_building.trim()) e.house_no_building = "Required";
    if (!form.address_line_1.trim()) e.address_line_1 = "Required";
    if (!form.area_locality.trim()) e.area_locality = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!form.district.trim()) e.district = "Required";
    if (!form.state.trim()) e.state = "Required";
    if (!form.country.trim()) e.country = "Required";
    if (!form.pincode.trim()) e.pincode = "Required";
    if (!form.latitude) e.latitude = "Required — pick on map";
    if (!form.longitude) e.longitude = "Required — pick on map";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!validate()) { messageApi.error("Please fill all required fields and pin on map"); return; }
    const token = localStorage.getItem("token");
    if (!token) { messageApi.error("Not logged in"); return; }
    setSaving(true);
    const payload = {
      address_type: form.address_type,
      label: form.label,
      house_no_building: form.house_no_building,
      address_line_1: form.address_line_1,
      address_line_2: form.address_line_2,
      address_line_3: form.address_line_3,
      area_locality: form.area_locality,
      landmark: form.landmark,
      city: form.city,
      district: form.district,
      state: form.state,
      country: form.country,
      pincode: form.pincode,
      delivery_notes: form.delivery_notes,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      location: {
        type: "Point",
        coordinates: [parseFloat(form.longitude), parseFloat(form.latitude)],
      },
      formatted_address:
        form.formatted_address ||
        `${form.house_no_building}, ${form.area_locality}, ${form.city}`,
      place_id: form.place_id,
      map_provider: "google",
      is_verified: mapFilled,
      is_default: form.is_default,
    };
    try {
      let savedAddr = null;
      if (editAddress?._id) {
        const res = await apiClient.put(`${API_URL}/addresses/${editAddress._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        savedAddr = res.data;
        messageApi.success("Address updated!");
      } else {
        const res = await apiClient.post(`${API_URL}/addresses`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        savedAddr = res.data;
        messageApi.success("Address saved!");
      }
      setTimeout(() => { onSaved?.(savedAddr); onClose(); }, 700);
    } catch (err: any) {
      messageApi.error(err.response?.data?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  /* ── Field sub-component ── */
  const Field = ({
    label, name, placeholder, required, type = "text",
  }: {
    label: string; name: keyof AddressFormData; placeholder?: string; required?: boolean; type?: string;
  }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-red-500 text-xs">*</span>}
      </label>
      <input
        type={type}
        value={form[name] as string}
        onChange={e => set(name, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium text-slate-800 placeholder:text-slate-300 outline-none transition-all focus:ring-2 focus:ring-[#1D2B83]/20 focus:border-[#1D2B83]/50 ${
          errors[name] ? "border-red-400 bg-red-50/50" : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
        }`}
      />
      {errors[name] && <span className="text-[10px] text-red-500 font-semibold">{errors[name]}</span>}
    </div>
  );

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {contextHolder}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
            onClick={onClose}
          />
          <div className="fixed inset-0 flex items-center justify-center z-[301] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#1D2B83]/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#1D2B83]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-800">{editAddress ? "Edit Address" : "Add New Address"}</h2>
                    <p className="text-xs text-slate-400 font-medium">Enter details or pick on map</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                <div className="p-6 space-y-6">

                  {/* Address Type */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                      Address Type <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-3 mb-3">
                      {(["Home", "Work", "Other"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => set("address_type", t)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                            form.address_type === t
                              ? "border-[#1D2B83] bg-[#1D2B83]/5 text-[#1D2B83]"
                              : "border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          {t === "Home" ? <Home className="w-4 h-4" /> : t === "Work" ? <Briefcase className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          {t}
                        </button>
                      ))}
                    </div>
                    {form.address_type === "Other" && (
                      <Field name="label" label="Custom Label" placeholder="e.g. Mom's House, Gym" />
                    )}
                  </div>

                  {/* Address Details */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin className="w-4 h-4 text-[#1D2B83]" />
                      <span className="text-sm font-black text-[#1D2B83] uppercase tracking-wider">Address Details</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field name="house_no_building" label="House / Building No." placeholder="Flat 402, Green Residency" required />
                      <Field name="address_line_1" label="Address Line 1" placeholder="Street name, Society" required />
                      <Field name="address_line_2" label="Address Line 2" placeholder="Tower A, etc. (Optional)" />
                      <Field name="address_line_3" label="Address Line 3" placeholder="Floor, etc. (Optional)" />
                      <Field name="area_locality" label="Area / Locality" placeholder="MG Road, Kothaguda" required />
                      <Field name="landmark" label="Landmark" placeholder="Near Metro Station (Optional)" />
                      <Field name="city" label="City" placeholder="Enter city" required />
                      <Field name="district" label="District" placeholder="Enter district" required />
                      <Field name="state" label="State" placeholder="Enter state" required />
                      <Field name="country" label="Country" placeholder="Enter country" required />
                      <Field name="pincode" label="Pincode" placeholder="6-digit pincode" required />
                      <Field name="delivery_notes" label="Delivery Notes" placeholder="e.g. Ring bell twice" />
                    </div>

                    {/* Default toggle */}
                    <label className="flex items-center gap-3 mt-4 cursor-pointer group">
                      <div
                        onClick={() => set("is_default", !form.is_default)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          form.is_default ? "bg-[#1D2B83] border-[#1D2B83]" : "border-slate-300 group-hover:border-[#1D2B83]/50"
                        }`}
                      >
                        {form.is_default && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-bold text-slate-600">Set as default address</span>
                    </label>
                  </div>

                  {/* Google Map Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Map className="w-4 h-4 text-[#1D2B83]" />
                        <div>
                          <span className="text-sm font-black text-[#1D2B83] uppercase tracking-wider">Search Address on Map</span>
                          <p className="text-[10px] text-slate-400 font-medium">Search and click on map to auto-fill fields above</p>
                        </div>
                      </div>
                      {/* GPS button */}
                      <button
                        type="button"
                        onClick={handleGPS}
                        disabled={isLocating}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all disabled:opacity-50"
                      >
                        {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                        Use GPS
                      </button>
                    </div>

                    {/* Google Maps Autocomplete Search */}
                    {isLoaded && (
                      <div className="mb-3">
                        <Autocomplete
                          onLoad={ac => { autocompleteRef.current = ac; }}
                          onPlaceChanged={onPlaceChanged}
                          options={{
                            componentRestrictions: { country: "in" },
                            fields: ["geometry", "formatted_address", "address_components", "place_id"],
                          }}
                        >
                          <div className="relative flex items-center border border-slate-200 rounded-xl bg-slate-50/50 focus-within:border-[#1D2B83]/50 focus-within:ring-2 focus-within:ring-[#1D2B83]/20 transition-all">
                            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search for your address, area, landmark..."
                              className="w-full pl-9 pr-4 py-3 rounded-xl bg-transparent text-sm font-medium text-slate-800 placeholder:text-slate-300 outline-none"
                            />
                            {isLocating && <Loader2 className="absolute right-3 w-4 h-4 text-slate-400 animate-spin" />}
                          </div>
                        </Autocomplete>
                      </div>
                    )}

                    {/* Map */}
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                      {loadError ? (
                        <div className="w-full h-[280px] bg-red-50 flex items-center justify-center text-red-500 text-sm font-bold">
                          Error loading Google Maps. Check your API key.
                        </div>
                      ) : !isLoaded ? (
                        <div className="w-full h-[280px] bg-slate-50 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 text-[#1D2B83] animate-spin" />
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Initialising Google Maps...</p>
                        </div>
                      ) : (
                        <GoogleMap
                          mapContainerStyle={MAP_CONTAINER_STYLE}
                          center={mapCenter}
                          zoom={markerPos === INDIA_CENTER ? 5 : 16}
                          onClick={onMapClick}
                          options={{
                            disableDefaultUI: true,
                            zoomControl: true,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                          }}
                        >
                          <Marker
                            position={markerPos}
                            draggable={true}
                            onDragEnd={onMarkerDragEnd}
                            animation={google.maps.Animation.DROP}
                          />
                        </GoogleMap>
                      )}

                      {/* Bottom hint bar */}
                      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-slate-100 px-4 py-2 flex items-center gap-2">
                        <Navigation className="w-3.5 h-3.5 text-[#1D2B83]" />
                        <p className="text-[10px] font-bold text-slate-500">
                          Click on the map or drag the pin to set your exact location
                        </p>
                        {isLocating && (
                          <span className="ml-auto text-[10px] font-black text-blue-600 uppercase tracking-widest animate-pulse flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Auto-fill success banner */}
                    {mapFilled && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex items-center justify-between px-4 py-3 bg-emerald-50 rounded-xl border border-emerald-100"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">Address auto-filled from Google Maps</span>
                        </div>
                        <button
                          onClick={() => { setForm(EMPTY); setMapFilled(false); setMapCenter(INDIA_CENTER); setMarkerPos(INDIA_CENTER); }}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900"
                        >
                          <RefreshCw className="w-3 h-3" /> Clear
                        </button>
                      </motion.div>
                    )}

                    {/* Lat/Lng read-only display */}
                    {form.latitude && form.longitude && (
                      <div className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                          {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}
                        </span>
                      </div>
                    )}
                    {(errors.latitude || errors.longitude) && (
                      <p className="mt-1 text-[11px] text-red-500 font-semibold">
                        📍 Please pin your location on the map or use GPS
                      </p>
                    )}
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-8 py-2.5 rounded-xl bg-[#1D2B83] text-white text-sm font-bold hover:bg-[#1D2B83]/90 transition-all flex items-center gap-2 disabled:opacity-60"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <>{editAddress ? "Update Address" : "Save Address"}</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
