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
} from "lucide-react";
import { API_URL, apiClient } from "@/config/api";

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position state
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        minWidth: Math.max(rect.width, 320),
      });
    }
  }, [isOpen, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;

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
            <div className="px-4 pt-4 pb-2 border-b border-slate-50">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Your Location
              </p>
            </div>

            <div className="p-3 space-y-1.5 max-h-[380px] overflow-y-auto no-scrollbar">
              <div className="p-3">
                {addresses.length >= MAX_ADDRESSES ? (
                  <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                      <MapIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-black text-amber-700">Address limit reached</p>
                      <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
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
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-blue-50/50 hover:bg-blue-50 rounded-xl transition-colors group border border-blue-100/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Navigation className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black text-blue-700">Add New Address</p>
                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">
                          Using GPS or Map
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
              </div>   {/* Divider */}
              {isLoggedIn && (
                <div className="px-1 pt-1 pb-0.5">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Saved Addresses
                  </p>
                </div>
              )}

              {/* Saved addresses */}
              {isLoggedIn && loading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-slate-400 text-xs font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading...
                </div>
              ) : isLoggedIn && addresses.length > 0 ? (
                addresses.map((addr) => (
                  <button
                    key={addr._id}
                    onClick={() => {
                      const typeLabel =
                        addr.address_type === "Other" && addr.label
                          ? addr.label
                          : addr.address_type || "Address";
                      const areaLabel = [addr.area_locality, addr.city]
                        .filter(Boolean)
                        .join(", ");
                      const displayLabel = areaLabel
                        ? `${typeLabel} · ${areaLabel}`
                        : typeLabel;
                      onSelectAddress(displayLabel, addr._id);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-all group text-left"
                  >
                    <div
                      className={`w-9 h-9 ${getAddressIconBg(
                        addr.address_type
                      )} rounded-xl flex items-center justify-center flex-shrink-0`}
                    >
                      {getAddressIcon(addr.address_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {addr.address_type === "Other" && addr.label ? addr.label : addr.address_type || addr.city}
                        </p>
                        {addr.is_default && (
                          <span className="text-[8px] font-black uppercase tracking-tighter bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded flex-shrink-0">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {[
                          addr.house_no_building,
                          addr.address_line_1,
                          addr.area_locality,
                          addr.city,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
                  </button>
                ))
              ) : isLoggedIn ? (
                <div className="flex flex-col items-center py-5 text-center">
                  <MapIcon className="w-7 h-7 text-slate-200 mb-2" />
                  <p className="text-xs font-bold text-slate-400">
                    No saved addresses
                  </p>
                </div>
              ) : null}


            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AddressDropdown;
