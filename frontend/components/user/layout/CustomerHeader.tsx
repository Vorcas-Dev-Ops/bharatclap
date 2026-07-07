"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  MapPin,
  Menu,
  ShoppingCart,
  User,
  ChevronDown
} from "lucide-react";
import AddressFormModal from "../profile/AddressFormModal";
import AddressDropdown from "../../common/AddressDropdown";
import ProfileModal from "../profile/ProfileModal";
import { useCart } from "@/context/CartContext";
import { API_URL, apiClient } from "@/config/api";

interface CustomerHeaderProps {
  onMenuClick: () => void;
}

const CustomerHeader: React.FC<CustomerHeaderProps> = ({ onMenuClick }) => {
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isAddressDropdownOpen, setIsAddressDropdownOpen] = useState(false);
  const [locationObj, setLocationObj] = useState<{ title: string; subtitle: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const { itemCount } = useCart();

  const syncDefaultAddress = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await apiClient.get(`${API_URL}/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const addresses = res.data;
      if (!Array.isArray(addresses) || addresses.length === 0) return;

      // Priority 1: User's selected address for this session
      const selectedId = localStorage.getItem("userLocationId");
      let targetAddr = null;
      if (selectedId) {
        targetAddr = addresses.find((a: any) => a._id === selectedId);
      }

      // Priority 2: User's default address
      if (!targetAddr) {
        targetAddr = addresses.find((a: any) => a.is_default) || addresses[0];
      }

      if (!targetAddr) return;

      const typeLabel =
        targetAddr.address_type === "Other" && targetAddr.label
          ? targetAddr.label
          : targetAddr.address_type || "Address";
      const areaLabel = [targetAddr.area_locality, targetAddr.city]
        .filter(Boolean)
        .join(", ");
        
      const newLocObj = { title: typeLabel, subtitle: areaLabel };
      setLocationObj(newLocObj);
      localStorage.setItem("userLocationObj", JSON.stringify(newLocObj));
      localStorage.setItem("userLocationId", targetAddr._id);
    } catch (err) {
      console.error("Failed to sync address:", err);
    }
  };

  useEffect(() => {
    setMounted(true);

    const loadUser = () => {
      const userData = localStorage.getItem("user");
      if (userData) {
        try { setUser(JSON.parse(userData)); } catch { setUser(null); }
      } else {
        setUser(null);
        setLocationObj(null);
      }
    };

    loadUser();

    // On every mount: if token exists, sync the default address immediately
    if (localStorage.getItem("token")) {
      syncDefaultAddress();
    }

    // Re-sync on these global events
    // When auth-login fires: sync address immediately (with tiny delay to ensure
    // localStorage is populated) and auto-open dropdown so user can confirm location
    const handleAuthLogin = () => {
      loadUser();
      setTimeout(async () => {
        await syncDefaultAddress();
        // If still no location set, open dropdown so user can pick one
        if (!localStorage.getItem("userLocation")) {
          setIsAddressDropdownOpen(true);
        }
      }, 100);
    };

    window.addEventListener("auth-login", handleAuthLogin);
    window.addEventListener("addressChanged", syncDefaultAddress);
    window.addEventListener("defaultAddressChanged", syncDefaultAddress);
    window.addEventListener("storage", loadUser);
    window.addEventListener("auth-logout", loadUser);

    return () => {
      window.removeEventListener("auth-login", handleAuthLogin);
      window.removeEventListener("addressChanged", syncDefaultAddress);
      window.removeEventListener("defaultAddressChanged", syncDefaultAddress);
      window.removeEventListener("storage", loadUser);
      window.removeEventListener("auth-logout", loadUser);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLocationSelect = (newLocation: string, id: string) => {
    localStorage.setItem("userLocationId", id);
    setIsLocationModalOpen(false);
    setIsAddressDropdownOpen(false);
    window.dispatchEvent(new Event("addressChanged"));
  };

  /** Opens the full modal with GPS detect (default view) */
  const handleAddNew = () => {
    setIsAddressDropdownOpen(false);
    setIsLocationModalOpen(true);
  };

  const displayLocation = location || "Select Location";

  return (
    <>
      <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 sm:px-8 border-b border-gray-100">
        <div className="flex items-center gap-4 flex-1">
          <button
            className="p-1.5 text-slate-500 hover:text-[#1D2B83] hover:bg-slate-100 rounded-lg transition-all lg:hidden"
            onClick={onMenuClick}
          >
            <Menu size={20} />
          </button>

          {/* Address button — opens dropdown, NOT the modal */}
          <button
            ref={locationBtnRef}
            onClick={() => setIsAddressDropdownOpen((prev) => !prev)}
            className="hidden md:flex items-center gap-2 group px-3 py-1.5 hover:bg-slate-50 rounded-xl transition-all text-left"
          >
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-600 mt-0.5" />
              <div className="flex flex-col max-w-[160px]">
                <span className="text-sm font-bold text-slate-800 leading-tight truncate">
                  {locationObj ? locationObj.title : "Select Location"}
                </span>
                {locationObj?.subtitle && (
                  <span className="text-[11px] font-medium text-slate-500 leading-tight truncate">
                    {locationObj.subtitle}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 mt-0.5 transition-transform ${isAddressDropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>
        </div>

        {/* Center: Welcome Message (Desktop) */}
        {mounted && user && (
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center leading-tight">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Welcome , </span>
            <span className="text-[10px] font-black text-[#1D2B83] uppercase tracking-[0.2em] mb-0.5">{user?.name || "User"}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-4 flex-1">
          {!mounted ? (
            <div className="w-20 h-8 bg-slate-100 animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/user/cart">
                <div className="p-2.5 hover:bg-slate-100 rounded-xl transition-all group relative">
                  <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-[#1D2B83]" />
                  {itemCount > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {itemCount}
                    </span>
                  )}
                </div>
              </Link>

              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-center hover:scale-105 transition-transform cursor-pointer group overflow-hidden"
              >
                {user?.profile_image && user.profile_image !== "" ? (
                  <img src={user.profile_image} alt={user.name || "Profile"} className="w-full h-full object-cover" />
                ) : user?.name || user?.email ? (
                  <span className="text-xs font-black text-[#1D2B83]">
                    {(user.name || user.email || "U").split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                ) : (
                  <User className="w-5 h-5 text-[#1D2B83]" />
                )}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Address dropdown — shows saved addresses */}
      <AddressDropdown
        isOpen={isAddressDropdownOpen}
        anchorRef={locationBtnRef}
        onClose={() => setIsAddressDropdownOpen(false)}
        onSelectAddress={handleLocationSelect}
        onAddNew={handleAddNew}
      />

      {/* Address form modal directly opened when "Add new" is clicked */}
      <AddressFormModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSaved={(addr) => {
          if (addr && addr.city) {
            handleLocationSelect(addr.city, addr._id);
          }
        }}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={(updatedUser) => {
          setUser(updatedUser);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }}
      />
    </>
  );
};

export default CustomerHeader;
