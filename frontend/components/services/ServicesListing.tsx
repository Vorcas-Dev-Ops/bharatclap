"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ServiceHero from "@/components/services/ServiceHero";
import ServiceCard from "@/components/services/ServiceCard";
import { API_URL, BACKEND_URL } from "@/config/api";
import { useCart } from "@/context/CartContext";
import { LoginModal } from "@/components/services/booking/LoginModal";
import TimeSlotModal from "@/components/services/booking/TimeSlotModal";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ServiceItem {
  id: string;
  serviceId: string;
  image: string;
  title: string;
  rating: number;
  price: string;
  priceValue: number;
  category: string;
}

const ServicesListing = () => {
  const [allServices, setAllServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [noProviderModal, setNoProviderModal] = useState<{ open: boolean; serviceName: string; location: string } | null>(null);
  // slotModal — opened after provider check passes
  const [slotModal, setSlotModal] = useState<{ open: boolean; subserviceId: string; serviceName: string } | null>(null);

  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") || "all";
  const searchParam = searchParams.get("search") || "";

  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [activeCategory, setActiveCategory] = useState(categoryParam);
  const [filters, setFilters] = useState({
    sortBy: "recommended",
    minPrice: "0",
    maxPrice: "99999",
    rating: "any",
  });

  const { cart: contextCart, addToCart, updateQuantity } = useCart();

  // Map contextCart to a simple object for faster lookup
  const cartMap = useMemo(() => {
    const record: Record<string, number> = {};
    contextCart?.items?.forEach((item: any) => {
      const id = item.subservice_id?._id || item.subservice_id;
      if (id) record[id] = item.quantity;
    });
    return record;
  }, [contextCart]);

  const handleUpdateQuantity = async (subserviceId: string, delta: number) => {
    // Auth Check
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") {
      setShowLoginModal(true);
      return;
    }

    const currentQty = cartMap[subserviceId] || 0;
    const newQty = currentQty + delta;

    if (currentQty === 0 && delta > 0) {
      // ── Step 1: lightweight availability check via provider-service ────────
      const location_id   = typeof window !== "undefined" ? localStorage.getItem("userLocationId") : null;
      const location_name = typeof window !== "undefined" ? localStorage.getItem("userLocation")   : null;
      const params = new URLSearchParams({ subservice_id: subserviceId });
      if (location_id)   params.set("location_id",   location_id);
      if (location_name) params.set("location_name", location_name);

      let available = true;
      try {
        const res = await fetch(`${API_URL}/providers/check-availability?${params.toString()}`);
        const data = await res.json();
        available = !!data.available;
      } catch {
        available = true; // fail-open so connectivity issues don't block users
      }

      if (!available) {
        const svc = allServices.find(s => s.id === subserviceId);
        setNoProviderModal({ open: true, serviceName: svc?.title || "This service", location: location_name || "your area" });
        return;
      }

      // ── Step 2: open time slot modal ──────────────────────────────────────
      const svc = allServices.find(s => s.id === subserviceId);
      setSlotModal({ open: true, subserviceId, serviceName: svc?.title || "Service" });
    } else {
      await updateQuantity(subserviceId, newQty);
    }
  };

  // Called after user picks date+slot in TimeSlotModal
  const handleSlotConfirmed = async (date: string, slot: string) => {
    if (!slotModal) return;
    setSlotModal(null);
    const result = await addToCart(slotModal.subserviceId, 1, date, slot);
    if (result && result.error === "NO_PROVIDER_AVAILABLE") {
      const locationName = typeof window !== "undefined" ? (localStorage.getItem("userLocation") || "your area") : "your area";
      setNoProviderModal({ open: true, serviceName: slotModal.serviceName, location: locationName });
    }
  };


  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/sub-services`);
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        const data = await response.json();
        
        const mappedData: ServiceItem[] = data.map((item: any) => {
          let imageUrl = "/images/services/placeholder.png";
          if (item.image) {
            imageUrl = item.image.startsWith('http') ? item.image : `${BACKEND_URL}${item.image}`;
          }
          
          return {
            id: item._id,
            serviceId: item.service_id?._id || item.service_id,
            image: imageUrl,
            title: item.subservice_name,
            rating: item.avg_rating || 0,
            price: `₹${item.base_price}`,
            priceValue: item.base_price,
            category: item.service_id?.category_id?.category_name?.toLowerCase().replace(/ /g, '-') || "other",
          };
        });
        
        setAllServices(mappedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [categoryParam]);

  // Sync with param change
  useEffect(() => {
    if (categoryParam) {
      setActiveCategory(categoryParam);
    }
    if (searchParam !== undefined) {
      setSearchQuery(searchParam);
    }
  }, [categoryParam, searchParam]);

  const filteredServices = useMemo(() => {
    let result = [...allServices];

    // Category Filter
    if (activeCategory !== "all") {
      result = result.filter((service) => service.category === activeCategory);
    }

    // Search Filter
    if (searchQuery) {
      result = result.filter((service) =>
        (service.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Price Filter
    const min = parseFloat(filters.minPrice) || 0;
    const max = parseFloat(filters.maxPrice) || Infinity;
    result = result.filter(
      (service) => service.priceValue >= min && service.priceValue <= max
    );

    // Rating Filter
    if (filters.rating !== "any") {
      const minRating = parseFloat(filters.rating);
      result = result.filter((service) => service.rating >= minRating);
    }

    // Sort
    switch (filters.sortBy) {
      case "low-high":
        result.sort((a, b) => a.priceValue - b.priceValue);
        break;
      case "high-low":
        result.sort((a, b) => b.priceValue - a.priceValue);
        break;
      case "top-rated":
        result.sort((a, b) => b.rating - a.rating);
        break;
      default:
        break;
    }

    return result;
  }, [searchQuery, filters, activeCategory, allServices]);

  return (
    <>
      <ServiceHero 
        onSearch={setSearchQuery} 
        onApplyFilters={setFilters} 
      />

      {/* All Services Grid Section */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800">
              {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'} found
              {activeCategory !== "all" && <span className="text-[#1D2B83] capitalize"> in {activeCategory.replace("-", " ")}</span>}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-[#1D2B83] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20 text-red-500 font-bold">
              {error}
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 border-t border-slate-100 pt-10">
              {filteredServices.map((service) => (
                <ServiceCard
                  key={service.id}
                  id={service.serviceId}
                  subserviceId={service.id}
                  image={service.image}
                  title={service.title}
                  rating={service.rating}
                  price={service.price}
                  onAddToCart={handleUpdateQuantity}
                  cartQuantity={cartMap[service.id]}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border-t border-slate-100">
              <p className="text-slate-400 text-lg font-medium">No services found matching your criteria.</p>
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  setFilters({
                    sortBy: "recommended",
                    minPrice: "0",
                    maxPrice: "99999",
                    rating: "any",
                  });
                }}
                className="mt-4 text-[#1D2B83] font-bold underline underline-offset-4"
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>
      </section>

      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

      {/* No Provider Available Modal */}
      <AnimatePresence>
        {noProviderModal?.open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoProviderModal(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300]"
            />
            <div className="fixed inset-0 flex items-center justify-center z-[301] p-4">
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, y: 30 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
              >
                {/* Header accent */}
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />

                <div className="p-7">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>

                  {/* Heading */}
                  <h3 className="text-xl font-black text-slate-800 text-center mb-2">
                    No Providers Available
                  </h3>

                  {/* Body */}
                  <p className="text-slate-500 text-sm text-center leading-relaxed">
                    Sorry, <span className="font-bold text-slate-700">{noProviderModal.serviceName}</span> doesn&apos;t have any verified providers serving{" "}
                    <span className="font-bold text-[#1D2B83]">{noProviderModal.location}</span> at the moment.
                  </p>

                  <p className="text-slate-400 text-xs text-center mt-2">
                    Try selecting a different location or check back later.
                  </p>

                  {/* CTA */}
                  <button
                    onClick={() => setNoProviderModal(null)}
                    className="mt-6 w-full h-12 bg-[#1D2B83] hover:bg-[#162268] text-white font-black text-sm rounded-2xl transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Time Slot Modal */}
      {slotModal && (
        <TimeSlotModal
          isOpen={slotModal.open}
          serviceName={slotModal.serviceName}
          mode="add"
          onClose={() => setSlotModal(null)}
          onConfirm={handleSlotConfirmed}
        />
      )}
    </>
  );
};

export default ServicesListing;
