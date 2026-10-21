"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Navigation,
  Home,
  Briefcase,
  ChevronRight,
  Loader2,
  Plus,
  MapIcon,
  CheckCircle2,
  ArrowLeft,
  Building,
} from "lucide-react";
import { API_URL, apiClient } from "@/config/api";
import { reverseGeocode, GeocodeResult } from "@/utils/geocode";

interface AddressObject {
  _id: string;
  address_type?: string;
  label?: string;
  house_no_building?: string;
  address_line_1?: string;
  area_locality?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

interface AddressDropdownProps {
  isOpen: boolean;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectAddress: (name: string, id: string) => void;
  onAddNew: () => void;
}

const MAX_ADDRESSES = 5;

const AddressDropdown: React.FC<AddressDropdownProps> = ({
  isOpen,
  anchorRef,
  onClose,
  onSelectAddress,
  onAddNew,
}) => {
  const [addresses, setAddresses] = useState<AddressObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Two-step flow: "main" (selection) or "details" (add house / flat number to detected GPS)
  const [step, setStep] = useState<"main" | "details">("main");
  const [detectedGeo, setDetectedGeo] = useState<GeocodeResult | null>(null);
  const [houseNo, setHouseNo] = useState("");
  const [streetLandmark, setStreetLandmark] = useState("");
  const [addressTag, setAddressTag] = useState<"Home" | "Work" | "Other">("Home");
  const [isSaving, setIsSaving] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: Math.max(rect.width, 360),
      });
    }
  }, [isOpen, anchorRef, step]);

  useEffect(() => {
    if (!isOpen) {
      setLocateError(null);
      setStep("main");
      setDetectedGeo(null);
      setHouseNo("");
      setStreetLandmark("");
      setAddressTag("Home");
      return;
    }

    const token = localStorage.getItem("token");
    const validToken =
      token && token !== "null" && token !== "undefined" && token.trim() !== "";
    setIsLoggedIn(!!validToken);

    if (validToken) {
      fetchAddresses(token.trim());
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose, anchorRef]);

  const fetchAddresses = async (token: string) => {
    try {
      setLoading(true);
      const response = await apiClient.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (Array.isArray(response.data)) {
        setAddresses(response.data);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        setIsLoggedIn(false);
        setAddresses([]);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * GPS Current Location Handler
   * Detects GPS -> prompts for House / Flat / Landmark details
   */
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const geo = await reverseGeocode(latitude, longitude);

          setDetectedGeo(geo);
          setStreetLandmark(geo.address_line_1 || geo.street || "");
          setStep("details");
        } catch (err: any) {
          console.error("GPS Reverse Geocode Error:", err);
          onSelectAddress("Bengaluru", "bengaluru-default");
          onClose();
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setLocateError("Location access denied. Please allow GPS permissions in your browser.");
        } else {
          setLocateError("Could not retrieve GPS location. Please select Bengaluru manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  /**
   * Save detected address with House Number & Landmark
   */
  const handleConfirmHouseAddress = async (skipHouseDetails = false) => {
    if (!detectedGeo) return;

    setIsSaving(true);
    const finalHouse = skipHouseDetails ? "" : houseNo.trim();
    const finalStreet = streetLandmark.trim() || detectedGeo.address_line_1 || "";
    const detectedArea = detectedGeo.area_locality || detectedGeo.district || "Bengaluru";
    const detectedCity = detectedGeo.city || "Bengaluru";

    // e.g. "Flat 402, Indiranagar, Bengaluru" or "Indiranagar, Bengaluru"
    const displayLabel = [finalHouse, detectedArea, detectedCity]
      .filter(Boolean)
      .join(", ");

    // If logged in, save to backend address book
    const token = localStorage.getItem("token");
    let savedId = "current-gps-location";

    if (token) {
      try {
        const payload = {
          address_type: addressTag,
          label: addressTag,
          house_no_building: finalHouse || "Detected Location",
          address_line_1: finalStreet,
          area_locality: detectedArea,
          city: detectedCity,
          district: detectedGeo.district || "Bengaluru Urban",
          state: detectedGeo.state || "Karnataka",
          country: "India",
          pincode: detectedGeo.pincode || "560001",
          latitude: detectedGeo.latitude,
          longitude: detectedGeo.longitude,
          location: {
            type: "Point",
            coordinates: [detectedGeo.longitude, detectedGeo.latitude],
          },
          formatted_address: displayLabel,
          is_default: addresses.length === 0,
        };

        const res = await apiClient.post(`${API_URL}/addresses`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data?._id) {
          savedId = res.data._id;
        }

        window.dispatchEvent(new Event("addressChanged"));
      } catch (saveErr) {
        console.warn("Could not save address to profile (local active will be used):", saveErr);
      }
    }

    // Persist locally
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "user_gps_location",
        JSON.stringify({
          latitude: detectedGeo.latitude,
          longitude: detectedGeo.longitude,
          house: finalHouse,
          area: detectedArea,
          city: detectedCity,
          display: displayLabel,
        })
      );
      localStorage.setItem("selected_city", "Bengaluru");
      localStorage.setItem("selected_address_display", displayLabel);
    }

    setIsSaving(false);
    onSelectAddress(displayLabel, savedId);
    onClose();
  };

  const getAddressIcon = (type?: string) => {
    switch (type) {
      case "Home":
        return <Home className="w-4 h-4 text-violet-600" />;
      case "Work":
        return <Briefcase className="w-4 h-4 text-sky-600" />;
      default:
        return <MapPin className="w-4 h-4 text-amber-600" />;
    }
  };

  const getAddressIconBg = (type?: string) => {
    switch (type) {
      case "Home":
        return "bg-violet-50";
      case "Work":
        return "bg-sky-50";
      default:
        return "bg-amber-50";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Invisible backdrop */}
          <div className="fixed inset-0 z-[150]" onClick={onClose} />

          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={dropdownStyle}
            className="fixed z-[200] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
          >
            {/* Header strip */}
            <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-50 flex items-center justify-between">
              {step === "details" ? (
                <button
                  type="button"
                  onClick={() => setStep("main")}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#1D2B83] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Service Location
                </p>
              )}

              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Bengaluru Active
              </span>
            </div>

            {/* STEP 1: Main Dropdown List */}
            {step === "main" ? (
              <div className="p-3 space-y-2.5 max-h-[440px] overflow-y-auto no-scrollbar">
                
                {/* PRIMARY OPTION: Use my current location (GPS) */}
                <div>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#1D2B83] text-white hover:bg-blue-900 shadow-md shadow-blue-900/15 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-110 transition-transform">
                        {isLocating ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Navigation className="w-4 h-4 text-emerald-300" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                          <span>Use my current location</span>
                          <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-400/25 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/30">
                            GPS
                          </span>
                        </p>
                        <p className="text-[10px] text-blue-100 font-medium">
                          {isLocating
                            ? "Detecting coordinates..."
                            : "Auto-detect location & set house number"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {locateError && (
                    <p className="text-[10px] text-red-500 font-semibold mt-1 px-1">
                      {locateError}
                    </p>
                  )}
                </div>

                {/* Notice Banner */}
                <div className="px-3 py-2 bg-blue-50/70 border border-blue-100 rounded-xl text-left">
                  <p className="text-[11px] font-semibold text-[#1D2B83] leading-snug">
                    Currently serving <span className="font-bold">Bengaluru</span>. All zones &amp; neighborhoods active!
                  </p>
                </div>

                {/* Operating Cities Section */}
                <div className="space-y-1">
                  <div className="px-1 pt-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Active City
                    </p>
                  </div>
                  
                  {/* Active City: Bengaluru */}
                  <button
                    onClick={() => {
                      onSelectAddress("Bengaluru", "bengaluru-default");
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-emerald-200/80 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                          Bengaluru, Karnataka
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">All zones active</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  </button>
                </div>

                {/* Add New Address */}
                <div className="pt-2">
                  {addresses.length >= MAX_ADDRESSES ? (
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <MapIcon className="w-3 h-3" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-amber-700">Address limit reached</p>
                        <p className="text-[9px] font-medium text-amber-600">
                          Max {MAX_ADDRESSES} addresses allowed
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onAddNew();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 bg-blue-50/50 hover:bg-blue-50 rounded-xl transition-colors group border border-blue-100/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-blue-700">Add Custom Address</p>
                          <p className="text-[9px] font-medium text-blue-500">
                            Save full apartment, house or office
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>

                {/* Saved addresses */}
                {isLoggedIn && (
                  <div className="px-1 pt-2 pb-0.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Saved Addresses
                    </p>
                  </div>
                )}

                {isLoggedIn && loading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-slate-400 text-xs font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D2B83]" />
                    Loading your addresses...
                  </div>
                ) : isLoggedIn && addresses.length > 0 ? (
                  <div className="space-y-1.5">
                    {addresses.map((addr) => {
                      const fullAddress = [
                        addr.house_no_building,
                        addr.address_line_1,
                        addr.area_locality,
                      ]
                        .filter(Boolean)
                        .join(", ");

                      const label =
                        addr.label || addr.address_type || "Saved Address";

                      return (
                        <button
                          key={addr._id}
                          onClick={() => {
                            const display = addr.area_locality
                              ? `${addr.area_locality}, ${addr.city}`
                              : `${addr.city}`;
                            onSelectAddress(display, addr._id);
                            onClose();
                          }}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left group border border-transparent hover:border-slate-200/80"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg ${getAddressIconBg(
                                addr.address_type
                              )} flex items-center justify-center flex-shrink-0`}
                            >
                              {getAddressIcon(addr.address_type)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-slate-800 truncate">
                                  {label}
                                </p>
                                {addr.is_default && (
                                  <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                {fullAddress || `${addr.city}, ${addr.pincode}`}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                ) : isLoggedIn && !loading ? (
                  <p className="text-[11px] text-slate-400 px-3 py-1">
                    No saved addresses yet
                  </p>
                ) : null}
              </div>
            ) : (
              /* STEP 2: Add House / Flat Number to Detected GPS Location */
              <div className="p-3.5 space-y-3.5 max-h-[480px] overflow-y-auto no-scrollbar">
                
                {/* Detected Location Pill Banner */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live GPS Detected
                    </p>
                    <p className="text-xs font-black text-slate-800 truncate">
                      {detectedGeo?.area_locality || detectedGeo?.district || "Bengaluru"}, {detectedGeo?.city || "Bengaluru"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {detectedGeo?.formatted_address || "Bengaluru, Karnataka"}
                    </p>
                  </div>
                </div>

                {/* Form: House Number / Flat / Building */}
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Building className="w-3 h-3 text-[#1D2B83]" />
                    <span>House / Flat / Floor / Building No.</span>
                  </label>
                  <input
                    type="text"
                    value={houseNo}
                    onChange={(e) => setHouseNo(e.target.value)}
                    placeholder="e.g. Flat 302, Sunrise Apts / House #12"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D2B83]/20 focus:border-[#1D2B83]"
                    autoFocus
                  />
                </div>

                {/* Form: Street / Landmark */}
                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#1D2B83]" />
                    <span>Street / Landmark (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={streetLandmark}
                    onChange={(e) => setStreetLandmark(e.target.value)}
                    placeholder="e.g. Near Metro Station / 100ft Road"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1D2B83]/20 focus:border-[#1D2B83]"
                  />
                </div>

                {/* Address Type Tag Picker */}
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Save address as
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["Home", "Work", "Other"] as const).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setAddressTag(tag)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                          addressTag === tag
                            ? "bg-[#1D2B83] text-white border-[#1D2B83] shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {tag === "Home" && <Home className="w-3 h-3" />}
                        {tag === "Work" && <Briefcase className="w-3 h-3" />}
                        {tag === "Other" && <MapPin className="w-3 h-3" />}
                        <span>{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="pt-1 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmHouseAddress(false)}
                    disabled={isSaving}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1D2B83] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-900/15 transition-all"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{isSaving ? "Saving..." : "Save & Set Location"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmHouseAddress(true)}
                    disabled={isSaving}
                    className="w-full py-1.5 text-center text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Use area only (Skip house number)
                  </button>
                </div>

              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddressDropdown;
