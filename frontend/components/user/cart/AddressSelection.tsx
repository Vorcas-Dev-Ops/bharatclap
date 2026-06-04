"use client";

import React from "react";
import { MapPin, Info, ChevronRight } from "lucide-react";
import Link from "next/link";
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
            <p className="text-slate-500 font-medium leading-relaxed max-w-md">
              {defaultAddress.address_line}, {defaultAddress.landmark && `${defaultAddress.landmark}, `} {defaultAddress.city}, {defaultAddress.state} - {defaultAddress.pincode}
            </p>
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
