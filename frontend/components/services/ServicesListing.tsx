"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  Plus,
  Minus,
  Sparkles,
  Layers,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { API_URL, BACKEND_URL } from "@/config/api";
import { useCart } from "@/context/CartContext";
import { LoginModal } from "@/components/services/booking/LoginModal";
import TimeSlotModal from "@/components/services/booking/TimeSlotModal";
import CategoryIcon from "@/components/common/CategoryIcon";
import ServiceCard from "@/components/services/ServiceCard";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  description?: string;
}

interface SubServiceItem {
  id: string;
  serviceId: string;
  serviceName?: string;
  image: string;
  title: string;
  rating: number;
  price: string;
  priceValue: number;
  duration?: number;
  description?: string;
  category?: string;
}

const mapSubServiceItem = (item: any): SubServiceItem => {
  const serviceObj = item.service_id || item.service;
  const rawImg =
    item.image ||
    serviceObj?.image ||
    (Array.isArray(serviceObj?.images) && serviceObj.images[0]) ||
    serviceObj?.category_icon ||
    serviceObj?.category_id?.icon ||
    serviceObj?.category_id?.category_icon ||
    item.category_icon ||
    item.images?.[0];

  let imageUrl = "";
  if (rawImg) {
    imageUrl =
      rawImg.startsWith("http") || rawImg.startsWith("data:")
        ? rawImg
        : rawImg.startsWith("/")
        ? `${BACKEND_URL}${rawImg}`
        : rawImg;
  }

  const basePrice = item.packages?.[0]?.base_price ?? item.base_price ?? 0;

  return {
    id: item._id || item.id,
    serviceId: serviceObj?._id || serviceObj?.id || serviceObj || item.service_id,
    serviceName: serviceObj?.service_name || serviceObj?.name || "",
    image: imageUrl,
    title: item.subservice_name || item.name || "Service",
    rating: item.avg_rating || item.rating || 4.8,
    price: basePrice > 0 ? `₹${basePrice}` : "Price on request",
    priceValue: basePrice,
    duration: item.duration || 30,
    description: item.description || "",
    category:
      serviceObj?.category_id?.category_name?.toLowerCase().replace(/ /g, "-") ||
      "other",
  };
};

const ServicesListing = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [popularServices, setPopularServices] = useState<SubServiceItem[]>([]);
  const [categorySubServices, setCategorySubServices] = useState<Record<string, SubServiceItem[]>>({});
  const [loadingCategoryIds, setLoadingCategoryIds] = useState<Record<string, boolean>>({});
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({});

  const [initialLoading, setInitialLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>("all");

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [noProviderModal, setNoProviderModal] = useState<{
    open: boolean;
    serviceName: string;
    location: string;
  } | null>(null);
  const [slotModal, setSlotModal] = useState<{
    open: boolean;
    subserviceId: string;
    serviceName: string;
  } | null>(null);

  const { cart: contextCart, addToCart, updateQuantity } = useCart();
  const categorySectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Quick lookup for cart item quantities
  const cartMap = useMemo(() => {
    const record: Record<string, number> = {};
    contextCart?.items?.forEach((item: any) => {
      const id = item.subservice_id?._id || item.subservice_id;
      if (id) record[id] = item.quantity;
    });
    return record;
  }, [contextCart]);

  // Initial load: Fetch categories and popular services
  const loadInitialData = async () => {
    setInitialLoading(true);
    try {
      const [catsRes, popularRes] = await Promise.all([
        fetch(`${API_URL}/categories`, { cache: "no-store" }).catch(() => null),
        fetch(`${API_URL}/sub-services?limit=8`, { cache: "no-store" }).catch(() => null),
      ]);

      if (catsRes && catsRes.ok) {
        const catData = await catsRes.json();
        const list = Array.isArray(catData) ? catData : catData.data || [];
        const mappedCats: CategoryItem[] = list.map((c: any) => ({
          id: c._id?.toString() || c.id?.toString() || "",
          name: c.category_name || c.name || "Category",
          slug: (c.category_name || c.name || "").toLowerCase().replace(/ /g, "-"),
          icon: c.icon || c.image || "",
          image: c.image || c.icon || "",
          description: c.description || "",
        }));
        setCategories(mappedCats);

        // If URL has a category parameter, pre-select and expand it
        const paramCat = searchParams.get("category");
        if (paramCat && paramCat !== "all") {
          const matched = mappedCats.find(c => c.slug === paramCat || c.id === paramCat);
          if (matched) {
            setSelectedCategorySlug(matched.slug);
            toggleCategory(matched.id, true);
          }
        }
      }

      if (popularRes && popularRes.ok) {
        const popData = await popularRes.json();
        const list = Array.isArray(popData) ? popData : popData.data || [];
        setPopularServices(list.map(mapSubServiceItem));
      }
    } catch (err) {
      console.error("Error loading services data:", err);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch sub-services for a category on demand
  const toggleCategory = async (categoryId: string, forceOpen?: boolean) => {
    setExpandedCategoryIds(prev => {
      const currentlyOpen = !!prev[categoryId];
      const willBeOpen = forceOpen !== undefined ? forceOpen : !currentlyOpen;
      return { ...prev, [categoryId]: willBeOpen };
    });

    // If sub-services for this category aren't in state yet, load on demand
    if (!categorySubServices[categoryId] && !loadingCategoryIds[categoryId]) {
      setLoadingCategoryIds(prev => ({ ...prev, [categoryId]: true }));
      try {
        const res = await fetch(`${API_URL}/sub-services?category_id=${categoryId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.data || [];
          setCategorySubServices(prev => ({
            ...prev,
            [categoryId]: list.map(mapSubServiceItem),
          }));
        } else {
          setCategorySubServices(prev => ({ ...prev, [categoryId]: [] }));
        }
      } catch (err) {
        console.error(`Error fetching subservices for category ${categoryId}:`, err);
        setCategorySubServices(prev => ({ ...prev, [categoryId]: [] }));
      } finally {
        setLoadingCategoryIds(prev => ({ ...prev, [categoryId]: false }));
      }
    }
  };

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter(c =>
      c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [categories, searchQuery]);

  // Handle clicking a category chip from the top Categories section
  const handleCategoryChipClick = (cat: CategoryItem | "all") => {
    if (cat === "all") {
      setSelectedCategorySlug("all");
      return;
    }

    setSelectedCategorySlug(cat.slug);
    // Expand category if not open
    toggleCategory(cat.id, true);

    // Scroll smoothly to that category
    setTimeout(() => {
      const el = categorySectionRefs.current[cat.id];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  // Cart operations
  const handleUpdateQuantity = async (subserviceId: string, delta: number) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || token === "null" || token === "undefined") {
      setShowLoginModal(true);
      return;
    }

    const currentQty = cartMap[subserviceId] || 0;
    const newQty = currentQty + delta;

    if (currentQty === 0 && delta > 0) {
      const location_id = typeof window !== "undefined" ? localStorage.getItem("userLocationId") : null;
      const location_name = typeof window !== "undefined" ? localStorage.getItem("userLocation") : null;
      const params = new URLSearchParams({ subservice_id: subserviceId });
      if (location_id) params.set("location_id", location_id);
      if (location_name) params.set("location_name", location_name);

      let available = true;
      try {
        const res = await fetch(`${API_URL}/providers/check-availability?${params.toString()}`);
        const data = await res.json();
        available = !!data.available;
      } catch {
        available = true;
      }

      const result = await addToCart(subserviceId, 1);
      if (result && result.error === "NO_PROVIDER_AVAILABLE") {
        setNoProviderModal({
          open: true,
          serviceName: "This service",
          location: location_name || "your area",
        });
      }
    } else {
      await updateQuantity(subserviceId, newQty);
    }
  };

  const handleSlotConfirmed = async (date: string, slot: string) => {
    if (!slotModal) return;
    setSlotModal(null);
    const result = await addToCart(slotModal.subserviceId, 1, date, slot);
    if (result && result.error === "NO_PROVIDER_AVAILABLE") {
      const locationName =
        typeof window !== "undefined"
          ? localStorage.getItem("userLocation") || "your area"
          : "your area";
      setNoProviderModal({
        open: true,
        serviceName: slotModal.serviceName,
        location: locationName,
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* ── Top Header & Search ───────────────────────────────────── */}
      <section className="bg-white border-b border-slate-200/80 pt-10 pb-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase">
              SERVICES
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-500 font-medium">
              Explore trusted home services, repair specialists, and pampering at your doorstep.
            </p>

            {/* Search Bar */}
            <div className="mt-6 relative max-w-xl mx-auto">
              <div className="relative flex items-center bg-slate-100/90 rounded-2xl border border-slate-200/80 px-4 py-3 shadow-inner focus-within:ring-2 focus-within:ring-[#1D2B83] focus-within:bg-white transition-all">
                <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
                <input
                  type="text"
                  placeholder="Search services (e.g. AC Repair, Cleaning, Electrician)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm sm:text-base text-slate-800 placeholder-slate-400 font-medium focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="p-1 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
        {/* ── 1. Categories Section ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#1D2B83]" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Categories
              </h2>
            </div>
            {selectedCategorySlug !== "all" && (
              <button
                onClick={() => handleCategoryChipClick("all")}
                className="text-xs font-bold text-[#1D2B83] hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>

          {initialLoading ? (
            <div className="flex gap-3 overflow-x-auto py-4 no-scrollbar animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-11 w-32 bg-slate-200/70 rounded-2xl shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-4">
              <button
                onClick={() => handleCategoryChipClick("all")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  selectedCategorySlug === "all"
                    ? "bg-[#1D2B83] text-white shadow-md shadow-[#1D2B83]/20"
                    : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span>All Categories</span>
              </button>

              {filteredCategories.map((cat) => {
                const isActive = selectedCategorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChipClick(cat)}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#1D2B83] text-white shadow-md shadow-[#1D2B83]/20"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <CategoryIcon
                        icon={cat.icon}
                        name={cat.name}
                        className={`w-full h-full object-contain ${
                          isActive ? "brightness-0 invert" : ""
                        }`}
                      />
                    </div>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 2. Popular Services Section ───────────────────────────── */}
        {!searchQuery && (
          <section>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-200 mb-6">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                Popular Services
              </h2>
            </div>

            {initialLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-72 bg-white rounded-3xl border border-slate-100 p-4"
                  >
                    <div className="h-44 bg-slate-200/70 rounded-2xl mb-4" />
                    <div className="h-4 bg-slate-200/70 rounded-full w-3/4 mb-2" />
                    <div className="h-4 bg-slate-200/70 rounded-full w-1/3" />
                  </div>
                ))}
              </div>
            ) : popularServices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {popularServices.slice(0, 4).map((service) => (
                  <ServiceCard
                    key={service.id}
                    id={service.serviceId}
                    subserviceId={service.id}
                    image={service.image}
                    title={service.title}
                    rating={service.rating}
                    price={service.price}
                    category={service.category}
                    onAddToCart={handleUpdateQuantity}
                    cartQuantity={cartMap[service.id]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No popular services listed.</p>
            )}
          </section>
        )}

        {/* ── 3. All Services (Hierarchical On-Demand Category Loading) ── */}
        <section>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-6">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              All Services
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"}
            </span>
          </div>

          {initialLoading ? (
            <div className="space-y-4 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-3xl border border-slate-100 p-6" />
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-800 font-bold text-base">No services found</p>
              <p className="text-slate-400 text-xs mt-1">Try searching for a different keyword or reset filters.</p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 px-4 py-2 bg-[#1D2B83] text-white text-xs font-bold rounded-xl"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {filteredCategories.map((cat) => {
                const isExpanded = !!expandedCategoryIds[cat.id];
                const isLoadingSub = !!loadingCategoryIds[cat.id];
                const subServices = categorySubServices[cat.id] || [];

                return (
                  <div
                    key={cat.id}
                    ref={(el) => {
                      categorySectionRefs.current[cat.id] = el;
                    }}
                    className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-sm ${
                      isExpanded
                        ? "border-[#1D2B83]/30 shadow-md ring-1 ring-[#1D2B83]/10"
                        : "border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    {/* Category Header Bar — Click to expand / collapse */}
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left transition-colors hover:bg-slate-50/80 focus:outline-none cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Category Icon */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-100 flex items-center justify-center p-2.5 shrink-0">
                          <CategoryIcon
                            icon={cat.icon}
                            name={cat.name}
                            className="w-full h-full object-contain"
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                            {cat.name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5 max-w-md">
                            {cat.description || "Browse available sub-services & repairs"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-xs font-bold text-[#1D2B83]">
                          {isExpanded ? "Hide Sub-services" : "View Sub-services"}
                        </span>
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                            isExpanded ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Sub-services Accordion Content — Loaded on Demand */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-slate-100 bg-slate-50/60 p-6 sm:p-7"
                        >
                          {isLoadingSub ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 animate-pulse">
                              {[...Array(4)].map((_, i) => (
                                <div
                                  key={i}
                                  className="h-64 bg-white rounded-3xl border border-slate-100 p-4"
                                >
                                  <div className="h-36 bg-slate-200/70 rounded-2xl mb-4" />
                                  <div className="h-4 bg-slate-200/70 rounded-full w-3/4 mb-2" />
                                  <div className="h-4 bg-slate-200/70 rounded-full w-1/3" />
                                </div>
                              ))}
                            </div>
                          ) : subServices.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                              {subServices.map((sub) => (
                                <ServiceCard
                                  key={sub.id}
                                  id={sub.serviceId}
                                  subserviceId={sub.id}
                                  image={sub.image || cat.icon || cat.image || ""}
                                  title={sub.title}
                                  rating={sub.rating}
                                  price={sub.price}
                                  category={sub.category || cat.name}
                                  onAddToCart={handleUpdateQuantity}
                                  cartQuantity={cartMap[sub.id]}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 p-6">
                              <p className="text-slate-500 font-bold text-sm">
                                No sub-services currently available for {cat.name}.
                              </p>
                              <p className="text-slate-400 text-xs mt-1">
                                Check back soon as our catalog is continuously updated.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
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
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden"
              >
                <div className="h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
                <div className="p-7">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-50 border border-amber-100">
                    <AlertTriangle className="w-8 h-8 text-amber-500" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 text-center mb-2">
                    No Providers Available
                  </h3>
                  <p className="text-slate-500 text-sm text-center leading-relaxed">
                    Sorry,{" "}
                    <span className="font-bold text-slate-700">
                      {noProviderModal.serviceName}
                    </span>{" "}
                    doesn&apos;t have verified providers serving{" "}
                    <span className="font-bold text-[#1D2B83]">
                      {noProviderModal.location}
                    </span>{" "}
                    at the moment.
                  </p>
                  <button
                    onClick={() => setNoProviderModal(null)}
                    className="mt-6 w-full h-12 bg-[#1D2B83] hover:bg-[#162268] text-white font-black text-sm rounded-2xl transition-colors cursor-pointer"
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
    </div>
  );
};

export default ServicesListing;
