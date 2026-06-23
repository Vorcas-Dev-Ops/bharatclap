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


  // Auth Protection: Handled by Context
  useEffect(() => {
    // We could add more logic here if needed, but context handles basic fetch
  }, []);


  // Fetch current service to get its category
  useEffect(() => {
    const fetchCurrentService = async () => {
      try {
        const response = await fetch(`${API_URL}/services/${initialServiceId}`);
        const data = await response.json();
        setCurrentService(data);

        // Now fetch all services in this category
        if (data.category_id?._id) {
          const sResponse = await fetch(`${API_URL}/services?category_id=${data.category_id._id}`);
          const sData = await sResponse.json();
          const mapped = sData.map((s: any) => ({
            id: s._id,
            title: s.service_name,
            image: (s.images && s.images[0]) || "",
            description: s.description,
            price: s.base_price,
          }));
          setServices(mapped);
        }
      } catch (err) {
        console.error("Failed to fetch service details", err);
      } finally {
        setServicesLoading(false);
      }
    };
    fetchCurrentService();
  }, [initialServiceId]);

  // Fetch Sub-services (Column 2) based on selectedServiceId
  useEffect(() => {
    const fetchSubServices = async () => {
      if (!selectedServiceId) return;
      try {
        setLoading(true);
        let url = `${API_URL}/sub-services?service_id=${selectedServiceId}`;
        if (selectedServiceId === 'all') {
          if (currentService?.category_id?._id) {
            url = `${API_URL}/sub-services?category_id=${currentService.category_id._id}`;
          } else {
            setLoading(false);
            return;
          }
        }
        console.log("Fetching sub-services from:", url);
        const response = await fetch(url);
        const data = await response.json();
        console.log("Sub-services data received:", data);

        const mappedData: SubServiceData[] = data.map((item: any) => ({
          id: String(item._id),
          title: item.subservice_name,
          rating: 4.8 + Math.random() * 0.2,
          reviews: `${Math.floor(Math.random() * 5000 + 1000)}`,
          price: item.base_price,
          duration: item.duration || "45-60 mins",
          description: item.description,
          image: item.image || "",
          features: [
            "Expert professional",
            "High-quality tools",
            "Mess-free experience",
            "Satisfaction guarantee",
          ],
        }));

        // Dynamic Luxury vs Prime segment filtering
        let filteredData = mappedData;
        if (segment) {
          const luxuryKeywords = ['advanced', 'combo', 'full body', 'gold', 'fruit', 'luxury', 'deep tissue', 'aroma', 'premium'];
          const luxuryPriceThreshold = 800;

          filteredData = mappedData.filter(ss => {
            const name = (ss.title || '').toLowerCase();
            const price = ss.price || 0;
            const matchesKeyword = luxuryKeywords.some(kw => name.includes(kw));
            const isLuxury = matchesKeyword || price >= luxuryPriceThreshold;

            if (segment.toLowerCase() === 'luxury') {
              return isLuxury;
            } else {
              return !isLuxury;
            }
          });
        }

        setSubServices(filteredData);
        // Automatically select the sub-service from URL or the first one
        if (filteredData.length > 0) {
          const preSelected = initialSubServiceId 
            ? filteredData.find(s => s.id === initialSubServiceId) 
            : null;
          setSelectedSubService(preSelected || filteredData[0]);
        }
      } catch (err) {
        console.error("Failed to fetch sub-services", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubServices();
  }, [selectedServiceId, segment]);


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
                  <p className="text-slate-400 text-xs text-center mt-2">Try selecting a different location or check back later.</p>
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

      <Footer />
    </main>
  );
};
