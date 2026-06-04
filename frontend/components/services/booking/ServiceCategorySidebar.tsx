"use client";

import React from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ServiceData {
  id: string;
  title: string;
  image: string;
  description: string;
  price: number;
}

interface ServiceCategorySidebarProps {
  categoryName: string;
  services: ServiceData[];
  selectedServiceId: string;
  onSelectService: (id: string) => void;
  loading: boolean;
  formatImageUrl: (url: string) => string;
}

export const ServiceCategorySidebar: React.FC<ServiceCategorySidebarProps> = ({
  categoryName,
  services,
  selectedServiceId,
  onSelectService,
  loading,
  formatImageUrl,
}) => {
  return (
    <aside className="lg:space-y-4">
      <div className="bg-white lg:rounded-3xl p-4 lg:p-5 shadow-sm border-b lg:border border-gray-100 -mx-4 lg:mx-0">
        <h2 className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 px-1">
          {categoryName || "Services"}
        </h2>

        {loading ? (
          <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse p-3 bg-gray-50 rounded-2xl min-w-[140px] lg:min-w-0">
                <div className="w-8 h-8 lg:w-14 lg:h-14 bg-gray-100 rounded-lg lg:rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1 hidden lg:block">
                  <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar pb-2 lg:pb-0 px-1 lg:px-0">
            {services.map((service) => (
              <button
                key={service.id}
                onClick={() => onSelectService(service.id)}
                className={`flex lg:w-full items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl lg:rounded-2xl transition-all border text-left group shrink-0 lg:shrink-1 ${
                  selectedServiceId === service.id
                    ? "bg-indigo-50 border-indigo-200"
                    : "bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
                }`}
              >
                <div className="relative w-8 h-8 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl overflow-hidden shrink-0 border border-gray-100 bg-gray-50">
                  <Image
                    src={formatImageUrl(service.image)}
                    alt={service.title || "Service Icon"}
                    fill
                    sizes="(max-width: 1024px) 32px, 56px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                </div>
                <div className="lg:flex-1 min-w-0 pr-2 lg:pr-0">
                  <h4
                    className={`text-xs lg:text-sm font-semibold truncate ${
                      selectedServiceId === service.id
                        ? "text-indigo-900"
                        : "text-gray-900"
                    }`}
                  >
                    {service.title}
                  </h4>
                  <p className="hidden lg:block text-xs font-medium text-gray-500 mt-0.5">
                    Starts at ₹{service.price}
                  </p>
                </div>
                <ChevronRight
                  className={`hidden lg:block w-4 h-4 shrink-0 transition-transform ${
                    selectedServiceId === service.id
                      ? "text-indigo-600 translate-x-1"
                      : "text-gray-300 group-hover:translate-x-1"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
