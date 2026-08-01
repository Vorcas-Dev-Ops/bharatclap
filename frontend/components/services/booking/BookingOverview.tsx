"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";

// Modular Components
import { ServiceSearchHeader } from "@/components/services/booking/ServiceSearchHeader";
import { ServiceCategorySidebar } from "@/components/services/booking/ServiceCategorySidebar";
import { SubServiceList } from "@/components/services/booking/SubServiceList";
import { ServiceDetailPreview } from "@/components/services/booking/ServiceDetailPreview";
import { CartFloatingBar } from "@/components/services/booking/CartFloatingBar";
import { LoginModal } from "@/components/services/booking/LoginModal";
import TimeSlotModal from "@/components/services/booking/TimeSlotModal";
import { useCart } from "@/context/CartContext";
import { API_URL, BACKEND_URL } from "@/config/api";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";


interface ServiceData {
  id: string;
  title: string;
  image: string;
  description: string;
  price: number;
}

interface SubServiceData {
  id: string;
  title: string;
  rating: number;
  reviews: string;
  price: number;
  duration: string;
  description: string;
  image: string;
  features: string[];
  preparations?: { title: string; isMandatory: boolean }[];
}

interface BookingOverviewProps {
  initialServiceId: string;
  segment?: string;
}

export const BookingOverview: React.FC<BookingOverviewProps> = ({
  initialServiceId,
  segment,
}) => {
  const router = useRouter();

  // State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [noProviderModal, setNoProviderModal] = useState<{ open: boolean; serviceName: string; location: string } | null>(null);
  const [slotModal, setSlotModal] = useState<{ open: boolean; subserviceId: string; serviceName: string } | null>(null);
  const [currentService, setCurrentService] = useState<any>(null);
  const [services, setServices] = useState<ServiceData[]>([]);
  const [subServices, setSubServices] = useState<SubServiceData[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(initialServiceId);
  const [selectedSubService, setSelectedSubService] = useState<SubServiceData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const { cart: contextCart, addToCart, updateQuantity, itemCount, totalAmount } = useCart();
  const searchParams = useSearchParams();
  const initialSubServiceId = searchParams.get("subservice");

  // Map contextCart to the local cart record format for compatibility with existing components
  const cart = React.useMemo(() => {
    const record: Record<string, number> = {};
    contextCart?.items?.forEach((item: any) => {
      const id = item.subservice_id?._id || item.subservice_id;
      if (id) record[id] = item.quantity;
    });
    return record;
  }, [contextCart]);

  // Robust fetch helper with fast auto-retry
  const fetchWithRetry = async (url: string, attempts = 2, initialDelay = 300): Promise<any> => {
    let delay = initialDelay;
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await fetch(url);
        const contentType = response.headers.get("content-type");
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Response is not JSON");
        }
        
        const data = await response.json();
        if (data && data.error === 'SERVICE_UNAVAILABLE') {
          throw new Error("Service is starting up or temporarily unavailable");
        }
        return data;
      } catch (err: any) {
        if (i === attempts - 1) throw err;
        console.warn(`[Fetch] Attempt ${i + 1} failed for ${url}. Retrying in ${delay}ms...`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }
  };

  // Auto-refresh when user switches back to the tab / window focus
  useEffect(() => {
    const handleFocus = () => {
      setRefetchTrigger((prev) => prev + 1);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Fetch complete booking overview bundle in ONE aggregate API call
  useEffect(() => {
    let isMounted = true;
    const fetchOverviewBundle = async () => {
      try {
        setError(null);
        setLoading(true);
        setServicesLoading(true);

        const bundle = await fetchWithRetry(`${API_URL}/services/booking-overview/${initialServiceId}`, 2, 300);
        if (!isMounted || !bundle) return;

        if (bundle.service) {
          setCurrentService(bundle.service);
        }
        if (Array.isArray(bundle.relatedServices)) {
          setServices(bundle.relatedServices);
        }
        if (Array.isArray(bundle.subServices)) {
          setSubServices(bundle.subServices);
          const preSelected = initialSubServiceId 
            ? bundle.subServices.find((s: SubServiceData) => s.id === initialSubServiceId) 
            : null;
          setSelectedSubService(preSelected || bundle.subServices[0] || null);
        }
      } catch (err) {
        console.error("Failed to fetch booking overview bundle", err);
        if (isMounted) setError("Catalog service is taking longer than usual to respond.");
      } finally {
        if (isMounted) {
          setLoading(false);
          setServicesLoading(false);
        }
      }
    };
    fetchOverviewBundle();
    return () => { isMounted = false; };
  }, [initialServiceId, refetchTrigger]);


  const handleUpdateQuantity = async (id: string, delta: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") {
      setShowLoginModal(true);
      return;
    }

    const currentQty = cart[id] || 0;
    const newQty = currentQty + delta;

    if (currentQty === 0 && delta > 0) {
      // Step 1: lightweight availability check
      const location_id   = typeof window !== "undefined" ? localStorage.getItem("userLocationId") : null;
      const location_name = typeof window !== "undefined" ? localStorage.getItem("userLocation")   : null;
      const params = new URLSearchParams({ subservice_id: id });
      if (location_id)   params.set("location_id",   location_id);
      if (location_name) params.set("location_name", location_name);

      let available = true;
      try {
        const res = await fetch(`${API_URL}/providers/check-availability?${params.toString()}`);
        const data = await res.json();
        available = !!data.available;
      } catch {
        available = true;
      }

      if (!available) {
        const svc = subServices.find(s => s.id === id);
        setNoProviderModal({ open: true, serviceName: svc?.title || "This service", location: location_name || "your area" });
        return;
      }

      // Step 2: open time slot modal
      const svc = subServices.find(s => s.id === id);
      setSlotModal({ open: true, subserviceId: id, serviceName: svc?.title || "Service" });
    } else {
      await updateQuantity(id, newQty);
    }
  };

  const handleSlotConfirmed = async (date: string, slot: string) => {
    if (!slotModal) return;
    setSlotModal(null);
    const result = await addToCart(slotModal.subserviceId, 1, date, slot);
    if (result && result.error === "NO_PROVIDER_AVAILABLE") {
      const locationName = typeof window !== "undefined" ? (localStorage.getItem("userLocation") || "your area") : "your area";
      setNoProviderModal({ open: true, serviceName: slotModal.serviceName, location: locationName });
    }
  };


  // Helper to format image URLs
  const formatImageUrl = (url: string) => {
    if (!url)
      return "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1469&auto=format&fit=crop";
    if (url.startsWith("http")) return url;
    const baseUrl = BACKEND_URL;
    if (url.startsWith("uploads/")) return `${baseUrl}/${url}`;
    if (url.startsWith("/uploads/")) return `${baseUrl}${url}`;
    return url;
  };

  const filteredSubServices = subServices.filter((s) =>
    s.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCartAmount = totalAmount;


  return (
    <main className="min-h-screen bg-[#f7f7fb]">
      <Navbar />

      <ServiceSearchHeader
        title={
          selectedServiceId === 'all'
            ? `${currentService?.category_id?.category_name || "All"} - Services`
            : services.find((s) => s.id === selectedServiceId)?.title || ""
        }
        optionsCount={filteredSubServices.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        cartItemCount={itemCount}
      />


      {/* Main 12-Column Layout */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-12">
        {error && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100/80 border border-amber-200 text-amber-600 animate-pulse">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Connection delay detected</p>
                <p className="text-xs text-slate-500">{error}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setError(null);
                setServicesLoading(true);
                setLoading(true);
                setRefetchTrigger(prev => prev + 1);
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap self-stretch sm:self-auto text-center animate-bounce animate-duration-1000"
            >
              Retry Connection
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          {/* Column 1: Left Sidebar (Full width on mobile, 3 columns on desktop) */}
          <div className="col-span-1 lg:col-span-3">
            <ServiceCategorySidebar
              categoryName={currentService?.category_id?.category_name}
              services={services}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
              loading={servicesLoading}
              formatImageUrl={formatImageUrl}
            />
          </div>

          {/* Column 2: Middle Content (Full width on mobile, 5 columns on desktop) */}
          <div className="col-span-1 lg:col-span-5">
            <SubServiceList
              title="Select Service Options"
              subServices={filteredSubServices}
              selectedSubServiceId={selectedSubService?.id}
              onSelectSubService={setSelectedSubService}
              onUpdateQuantity={handleUpdateQuantity}
              cart={cart}
              loading={loading}
              formatImageUrl={formatImageUrl}
            />

          </div>

          {/* Column 3: Right Detail Panel (Full width on mobile, 4 columns on desktop) */}
          <div className="col-span-1 lg:col-span-4">
            <ServiceDetailPreview
              selectedSubService={selectedSubService}
              cart={cart}
              onUpdateQuantity={handleUpdateQuantity}
              formatImageUrl={formatImageUrl}
            />
          </div>
        </div>
      </section>

      <CartFloatingBar cart={cart} totalAmount={totalCartAmount} />

      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

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
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
                <div className="p-7">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 text-center mb-2">No Providers Available</h3>
                  <p className="text-slate-500 text-sm text-center leading-relaxed">
                    Sorry, <span className="font-bold text-slate-700">{noProviderModal.serviceName}</span> doesn&apos;t have any verified providers serving{" "}
                    <span className="font-bold text-[#1D2B83]">{noProviderModal.location}</span> at the moment.
                  </p>
                  <p className="text-slate-400 text-xs text-center mt-2">Try selecting an alternative time slot or location:</p>
                  
                  {/* Interactive Alternative Time Slot Chips */}
                  <div className="mt-4 flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Suggested Slots:</span>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      {[
                        { time: '11:00 AM', label: '11:00 AM' },
                        { time: '02:00 PM', label: '02:00 PM' },
                        { time: '05:00 PM', label: '05:00 PM' }
                      ].map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => {
                            const subId = slotModal?.subserviceId || filteredSubServices[0]?.id;
                            const title = slotModal?.serviceName || "Service";
                            setNoProviderModal(null);
                            if (subId) {
                              setSlotModal({ open: true, subserviceId: subId, serviceName: title });
                            }
                          }}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setNoProviderModal(null)}
                    className="mt-5 w-full h-11 bg-[#1D2B83] hover:bg-[#162268] text-white font-black text-sm rounded-2xl transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  );
};
