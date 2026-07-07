"use client";

import React from "react";
import { MapPin, Info, ChevronRight } from "lucide-react";
import { Button } from "antd";

interface AddressSelectionProps {
  defaultAddress: any;
  onOpenAddressModal: () => void;
}

export default function AddressSelection({ defaultAddress, onOpenAddressModal }: AddressSelectionProps) {
  return (
    <section className="space-y-4">
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex items-start gap-6 group">
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#1D2B83] flex-shrink-0 group-hover:scale-110 transition-transform">
          <MapPin className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-black text-slate-800">Booking Address</h4>
            <Button
              type="link"
              onClick={onOpenAddressModal}
              className="text-blue-600 font-bold p-0 h-auto flex items-center gap-1 group/btn"
            >
              Change <ChevronRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </div>

          {defaultAddress ? (
            <div className="text-slate-500 font-medium leading-relaxed max-w-md space-y-0.5">
              {defaultAddress.address_type && (
                <span className="inline-flex items-center text-[#1D2B83] font-black text-[10px] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full mb-1">
                  {defaultAddress.address_type === "Other" && defaultAddress.label ? defaultAddress.label : defaultAddress.address_type}
                </span>
              )}
              <p className="font-bold text-slate-700 text-sm">
                {defaultAddress.house_no_building}
              </p>
              {(defaultAddress.address_line_1 || defaultAddress.area_locality) && (
                <p className="text-xs">
                  {[defaultAddress.address_line_1, defaultAddress.address_line_2, defaultAddress.area_locality].filter(Boolean).join(", ")}
                </p>
              )}
              {defaultAddress.landmark && (
                <p className="text-xs text-slate-400">📍 Near {defaultAddress.landmark}</p>
              )}
              <p className="text-xs text-slate-400">
                {defaultAddress.city}, {defaultAddress.state} – {defaultAddress.pincode}
              </p>
              {defaultAddress.latitude && defaultAddress.longitude && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${defaultAddress.latitude},${defaultAddress.longitude}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[11px] font-bold text-blue-600 mt-2 inline-flex items-center gap-1 hover:underline bg-blue-50 px-2 py-1 rounded-lg w-fit"
                  onClick={(e) => e.stopPropagation()}
                >
                  📍 View on Google Maps
                </a>
              )}
            </div>
          ) : (
            <p className="text-amber-500 font-bold flex items-center gap-2">
              <Info className="w-4 h-4" /> No default address selected
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
