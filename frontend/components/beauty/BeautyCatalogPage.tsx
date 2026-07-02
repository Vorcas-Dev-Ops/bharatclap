"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Star,
  AlertTriangle,
  Search,
  ChevronRight,
  LayoutGrid,
  Sparkles,
  Award,
  Leaf,
} from "lucide-react";
import { API_URL, BACKEND_URL } from "@/config/api";
import { useCart } from "@/context/CartContext";
import { LoginModal } from "@/components/services/booking/LoginModal";
import TimeSlotModal from "@/components/services/booking/TimeSlotModal";
import { ServiceDetailPreview } from "@/components/services/booking/ServiceDetailPreview";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface ApiService {
  _id: string;
  service_name: string;
  description: string;
  base_price: number;
  duration: number;
  image?: string;    // some records have a top-level image string
  images: string[];
  avg_rating: number;
  total_reviews: number;
  genderApplicability: "men" | "women";
  category_id: {
    _id: string;
    category_name: string;
    icon: string;
  };
}

interface ApiSubServicePackage {
  name: string;
  base_price: number;
  duration: number;
  variants?: { name: string; price: number }[];
}

interface ApiSubService {
  _id: string;
  subservice_name: string;
  description: string;
  base_price?: number;
  duration?: number;
  image: string;
  hasPackages?: boolean;
  packages?: ApiSubServicePackage[];
  service_preparations?: { title: string; isMandatory: boolean; _id?: string }[];
  service_id: {
    _id: string;
    service_name: string;
    category_id: {
      _id: string;
      category_name: string;
    };
  };
}

interface SidebarService {
  id: string;
  name: string;
  image: string;
  minPrice: number;
  gender: "men" | "women";
}

interface SubServiceItem {
  id: string;
  serviceId: string;
  serviceName: string;
  image: string;
  title: string;
  rating: number;
  reviewCount: number;
  price: string;
  priceValue: number;
  duration?: string;
  description?: string;
  hasPackages?: boolean;
  packages?: ApiSubServicePackage[];
  preparations?: { title: string; isMandatory: boolean }[];
}

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
function resolveImage(url: string): string {
  if (!url) return "/images/services/placeholder.png";
  if (url.startsWith("http")) return url;
  return `${BACKEND_URL}${url}`;
}

// ─────────────────────────────────────────────
// Package Icon Mapping
// ─────────────────────────────────────────────
const PACKAGE_ICONS: Record<string, React.ComponentType<any>> = {
  luxury: Sparkles,
  luxe: Sparkles,
  prime: Award,
  premium: Award,
  ayurveda: Leaf,
};

// ─────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────
interface BeautyCatalogPageProps {
  gender: "female" | "male";
  initialGroup?: string;
  initialTier?: string;
}

// ─────────────────────────────────────────────
// Service Card — matches SubServiceList style exactly
// ─────────────────────────────────────────────
interface ServiceCardProps {
  sub: SubServiceItem;
  cartQuantity: number;
  isSelected: boolean;
  onSelect: () => void;
  onAddToCart: (id: string) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  sub,
  cartQuantity,
  isSelected,
  onSelect,
  onAddToCart,
}) => {
  const isTopRated = sub.rating >= 4.8;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className={`bg-white rounded-3xl p-4 sm:p-5 border-2 transition-all cursor-pointer group hover:shadow-lg ${isSelected
        ? "border-indigo-600 shadow-md ring-2 ring-indigo-600/10"
        : "border-gray-100 shadow-sm hover:border-indigo-200"
        }`}
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* Left: text */}
        <div className="flex-1 space-y-2.5 order-2 sm:order-1">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {isTopRated && (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border border-amber-100">
                  Top Rated
                </span>
              )}
              <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                {sub.title}
              </h3>
            </div>

            {sub.rating > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700">
                    {sub.rating.toFixed(1)}
                  </span>
                </div>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-medium text-gray-400">
                  {sub.reviewCount.toLocaleString()} reviews
                </span>
              </div>
            )}
          </div>

          {sub.duration && (
            <div className="flex items-center gap-3 text-xs font-semibold text-gray-500">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                {sub.duration}
              </div>
            </div>
          )}

          {sub.description && (
            <p className="text-sm font-medium text-gray-500 line-clamp-2 leading-relaxed">
              {sub.description}
            </p>
          )}

          <div className="pt-1">
            <span className="text-xl font-bold text-gray-900">{sub.price}</span>
          </div>
        </div>

        {/* Right: image + ADD */}
        <div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-3 shrink-0 order-1 sm:order-2">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 group-hover:scale-[1.02] transition-transform duration-500">
            {sub.image ? (
              <img
                src={sub.image}
                alt={sub.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold">
                {sub.title?.[0] || "S"}
              </div>
            )}
          </div>

          <div className="flex-1 sm:w-full">
            {cartQuantity > 0 ? (
              <button className="w-full h-10 sm:h-11 px-4 sm:px-0 rounded-xl bg-indigo-600 text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider cursor-default">
                ADDED
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(sub.id);
                }}
                className="w-full h-10 sm:h-11 px-4 sm:px-0 rounded-xl border-2 border-indigo-600 text-indigo-600 font-bold text-[10px] sm:text-xs hover:bg-indigo-600 hover:text-white transition-all active:scale-95 uppercase tracking-wider"
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────
// Main Catalog Page
// ─────────────────────────────────────────────
const BeautyCatalogPage: React.FC<BeautyCatalogPageProps> = ({
  gender,
  initialGroup,
  initialTier,
}) => {
  const router = useRouter();
  const apiGender = gender === "female" ? "women" : "men";

  // Resolve defaults from URL segments if present
  const defaultGroup = (initialGroup && ["salon", "spa", "hair", "makeup"].includes(initialGroup))
    ? initialGroup
    : "salon";

  const defaultTier = (defaultGroup === "salon" || defaultGroup === "spa")
    ? ((initialTier && (
      defaultGroup === "spa"
        ? ["ayurveda", "luxe", "prime", "all"].includes(initialTier)
        : ["luxe", "premium", "all"].includes(initialTier)
    ))
      ? initialTier
      : "all")
    : "all"; // Hair and makeup have no tiers, so default is "all" to disable filtering

  // ── State ──
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sidebarServices, setSidebarServices] = useState<SidebarService[]>([]);
  const [allSubServices, setAllSubServices] = useState<SubServiceItem[]>([]);

  const [activeServiceId, setActiveServiceId] = useState<string>("all");
  // ── Premium filter header state ──
  const [activeGroup, setActiveGroup] = useState<string>(defaultGroup);
  const [activeTier, setActiveTier] = useState<string>(defaultTier);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state if URL changes (like browser back/forward buttons or direct navigation)
  useEffect(() => {
    if (initialGroup && ["salon", "spa", "hair", "makeup"].includes(initialGroup)) {
      setActiveGroup(initialGroup);
    } else {
      setActiveGroup("salon");
    }

    if (initialTier && (initialGroup === "salon" || initialGroup === "spa")) {
      setActiveTier(initialTier);
    } else {
      setActiveTier("all");
    }
  }, [initialGroup, initialTier]);

  // Redirect to a complete URL or clean tier from URL
  useEffect(() => {
    const group = initialGroup && ["salon", "spa", "hair", "makeup"].includes(initialGroup)
      ? initialGroup
      : "salon";

    if (group === "salon" || group === "spa") {
      const tier = initialTier && (
        group === "spa"
          ? ["ayurveda", "luxe", "prime", "all"].includes(initialTier)
          : ["luxe", "premium", "all"].includes(initialTier)
      )
        ? initialTier
        : "all";

      if (tier === "all") {
        if (initialGroup !== group || initialTier) {
          router.replace(`/beauty/${gender}/${group}`);
        }
      } else {
        if (initialGroup !== group || initialTier !== tier) {
          router.replace(`/beauty/${gender}/${group}/${tier}`);
        }
      }
    } else {
      // For hair and makeup, we don't have tiers in URL
      if (initialGroup !== group || initialTier) {
        router.replace(`/beauty/${gender}/${group}`);
      }
    }
  }, [initialGroup, initialTier, gender, router]);

  const { cart: contextCart, addToCart, updateQuantity } = useCart();
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

  const cartMap = useMemo(() => {
    const record: Record<string, number> = {};
    contextCart?.items?.forEach((item: any) => {
      const id = item.subservice_id?._id || item.subservice_id;
      if (id) record[id] = item.quantity;
    });
    return record;
  }, [contextCart]);

  // ── Step 1: Find the "Beauty & Wellness" category ID ──
  useEffect(() => {
    const findCategory = async () => {
      try {
        const res = await fetch(`${API_URL}/categories`);
        if (!res.ok) throw new Error("Failed to fetch categories");
        const cats: any[] = await res.json();
        const bw = cats.find(
          (c) =>
            c.category_name?.toLowerCase().includes("beauty") ||
            c.category_name?.toLowerCase().includes("wellness")
        );
        if (bw) setCategoryId(bw._id);
        else throw new Error("Beauty & Wellness category not found");
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    findCategory();
  }, []);

  // ── Step 2: Once we have categoryId, fetch services + subservices ──
  useEffect(() => {
    if (!categoryId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch services (sidebar tabs) — filtered by category + gender
        const [svcRes, subRes] = await Promise.all([
          fetch(
            `${API_URL}/services?category_id=${categoryId}`
          ),
          fetch(`${API_URL}/sub-services?category_id=${categoryId}`),
        ]);

        if (!svcRes.ok || !subRes.ok)
          throw new Error("Failed to fetch beauty data");

        const services: ApiService[] = await svcRes.json();
        const subServices: ApiSubService[] = await subRes.json();

        // Build sidebar service list
        const sidebar: SidebarService[] = services.map((svc) => ({
          id: svc._id,
          name: svc.service_name,
          // images[] may be empty; fall back to svc.image (string)
          image: resolveImage(svc.images?.[0] || svc.image || ""),
          minPrice: svc.base_price,
          gender: svc.genderApplicability,
        }));
        setSidebarServices(sidebar);

        // Build service ID set for gender filtering in subservices
        const genderServiceIds = new Set(services.map((s) => s._id));

        // Map subservices, filter to only those belonging to gender-matching services
        const mapped: SubServiceItem[] = subServices
          .filter((ss) => {
            const svcId =
              typeof ss.service_id === "object"
                ? ss.service_id._id
                : ss.service_id;
            return genderServiceIds.has(svcId);
          })
          .map((ss) => {
            const svcId =
              typeof ss.service_id === "object"
                ? ss.service_id._id
                : (ss.service_id as string);
            const svcName =
              typeof ss.service_id === "object"
                ? ss.service_id.service_name
                : "";

            // Price/duration may live at top level OR inside packages[0]
            const pkg = ss.packages?.[0];
            const priceVal =
              (ss.base_price != null ? ss.base_price : pkg?.base_price) ?? 0;
            const durationVal =
              (ss.duration != null ? ss.duration : pkg?.duration) ?? 0;

            return {
              id: ss._id,
              serviceId: svcId,
              serviceName: svcName,
              image: resolveImage(ss.image),
              title: ss.subservice_name,
              rating: 0,
              reviewCount: 0,
              price: priceVal > 0 ? `₹${priceVal}` : "Price on request",
              priceValue: priceVal,
              duration: durationVal > 0 ? `${durationVal} Mins` : undefined,
              description: ss.description,
              hasPackages: ss.hasPackages,
              packages: ss.packages,
              preparations: (ss.service_preparations || []).map((p) => ({
                title: p.title,
                isMandatory: p.isMandatory,
              })),
            };
          });

        setAllSubServices(mapped);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, apiGender]);

  // ── Service group → DB service keyword mapping ──
  const GROUP_KEYWORDS: Record<string, string[]> = {
    salon: ["facial", "cleanup", "manicure", "pedicure", "waxing", "nail", "threading", "bleach"],
    spa: ["massage", "therapy", "spa", "body", "ayurveda", "relaxation"],
    hair: ["hair", "haircut", "styling", "blow", "keratin", "color", "treatment"],
    makeup: ["makeup", "bridal", "mehndi", "mehendi", "brow", "lash", "eyebrow"],
  };

  // IDs of DB services that match the selected group
  const groupServiceIds = useMemo(() => {
    return new Set(sidebarServices.map((s) => s.id));
  }, [sidebarServices]);

  // Sidebar services filtered to match the selected activeGroup
  const visibleSidebarServices = useMemo(() => {
    return sidebarServices;
  }, [sidebarServices]);

  // ── Package pricing: Dynamic packages calculation ──
  const availablePackages = useMemo(() => {
    let subs = allSubServices.filter((s) => groupServiceIds.has(s.serviceId));
    if (activeServiceId !== "all") {
      subs = subs.filter((s) => s.serviceId === activeServiceId);
    }
    const pkgs = new Set<string>();
    subs.forEach((ss) => {
      if (ss.hasPackages && ss.packages) {
        ss.packages.forEach((p) => {
          if (p.name) pkgs.add(p.name);
        });
      }
    });
    return Array.from(pkgs);
  }, [allSubServices, groupServiceIds, activeServiceId]);

  // Sync selectedPackage when active service / category / availablePackages changes
  useEffect(() => {
    if (availablePackages.length > 0) {
      if (!selectedPackage || !availablePackages.includes(selectedPackage)) {
        setSelectedPackage(availablePackages[0]);
      }
    } else {
      setSelectedPackage(null);
    }
  }, [availablePackages, selectedPackage]);

  // ── Filtered subservices (group × sidebar × tier × package × search) ──
  const filteredSubs = useMemo(() => {
    // 1. Group filter
    let result = allSubServices.filter((s) => groupServiceIds.has(s.serviceId));

    // 2. Sidebar service filter (when a specific sidebar item is clicked)
    if (activeServiceId !== "all") {
      result = result.filter((s) => s.serviceId === activeServiceId);
    }

    // 3. Package filter & price/duration mapping
    if (selectedPackage) {
      result = result
        .filter((sub) => {
          if (!sub.hasPackages) return true; // Keep standard/flat pricing services
          return sub.packages?.some((p) => p.name === selectedPackage);
        })
        .map((sub) => {
          if (!sub.hasPackages) return sub;
          const pkg = sub.packages?.find((p) => p.name === selectedPackage);
          const priceVal = pkg?.base_price ?? 0;
          const durationVal = pkg?.duration ?? 0;
          return {
            ...sub,
            price: priceVal > 0 ? `₹${priceVal}` : "Price on request",
            priceValue: priceVal,
            duration: durationVal > 0 ? `${durationVal} Mins` : undefined,
          };
        });
    }

    // 4. Tier / Spa style filter (only if not package-based)
    if (availablePackages.length === 0 && activeTier !== "all") {
      const prices = result.map((s) => s.priceValue).filter((p) => p > 0);
      if (prices.length > 0) {
        const mn = Math.min(...prices);
        const mx = Math.max(...prices);

        if (activeGroup === "spa") {
          const third = (mx - mn) / 3;
          const bands: Record<string, [number, number]> = {
            ayurveda: [0, mn + third],
            luxe: [mn + third, mn + 2 * third],
            prime: [mn + 2 * third, Infinity],
          };
          const [lo, hi] = bands[activeTier] ?? [0, Infinity];
          result = result.filter((s) => s.priceValue > lo && s.priceValue <= hi);
        } else if (activeGroup === "salon") {
          const mid = (mn + mx) / 2;
          if (activeTier === "luxe") {
            result = result.filter((s) => s.priceValue > 0 && s.priceValue <= mid);
          } else if (activeTier === "premium") {
            result = result.filter((s) => s.priceValue > mid);
          }
        }
      }
    }

    // 5. Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => s.title.toLowerCase().includes(q));
    }
    return result;
  }, [allSubServices, groupServiceIds, activeServiceId, activeTier, activeGroup, searchQuery, selectedPackage, availablePackages]);

  // ── Active service name for page title ──
  const activeServiceName = useMemo(() => {
    if (activeServiceId === "all") return "Beauty & Wellness";
    return (
      sidebarServices.find((s) => s.id === activeServiceId)?.name ||
      "Beauty & Wellness"
    );
  }, [activeServiceId, sidebarServices]);

  // ── Selected subservice data mapped for preview panel ──
  const selectedSubService = useMemo(() => {
    if (!selectedSubId) return null;
    const sub = filteredSubs.find((s) => s.id === selectedSubId);
    if (!sub) return null;
    return {
      id: sub.id,
      title: sub.title,
      rating: sub.rating || 4.8,
      reviews: String(sub.reviewCount || 120),
      price: sub.priceValue || 0,
      duration: sub.duration || "45 Mins",
      description: sub.description || "",
      image: sub.image || "",
      features: [
        "Expert professional",
        "High-quality tools",
        "Mess-free experience",
        "Satisfaction guarantee",
      ],
      preparations: sub.preparations || [],
    };
  }, [selectedSubId, filteredSubs]);

  // Auto-select first subservice if none selected
  useEffect(() => {
    if (filteredSubs.length > 0) {
      if (!selectedSubId || !filteredSubs.some((s) => s.id === selectedSubId)) {
        setSelectedSubId(filteredSubs[0].id);
      }
    } else {
      setSelectedSubId(null);
    }
  }, [filteredSubs, selectedSubId]);

  // ── Cart handlers ──
  const handleAddToCart = useCallback(
    async (subserviceId: string) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token || token === "null" || token === "undefined") {
        setShowLoginModal(true);
        return;
      }

      const location_id =
        typeof window !== "undefined"
          ? localStorage.getItem("userLocationId")
          : null;
      const location_name =
        typeof window !== "undefined"
          ? localStorage.getItem("userLocation")
          : null;

      const params = new URLSearchParams({ subservice_id: subserviceId });
      if (location_id) params.set("location_id", location_id);
      if (location_name) params.set("location_name", location_name);

      let available = true;
      try {
        const res = await fetch(
          `${API_URL}/providers/check-availability?${params.toString()}`
        );
        const data = await res.json();
        available = !!data.available;
      } catch {
        available = true;
      }

      if (!available) {
        const svc = allSubServices.find((s) => s.id === subserviceId);
        setNoProviderModal({
          open: true,
          serviceName: svc?.title || "This service",
          location: location_name || "your area",
        });
        return;
      }

      const svc = allSubServices.find((s) => s.id === subserviceId);
      setSlotModal({
        open: true,
        subserviceId,
        serviceName: svc?.title || "Service",
      });
    },
    [allSubServices]
  );

  const handleSlotConfirmed = async (date: string, slot: string) => {
    if (!slotModal) return;
    setSlotModal(null);
    const sub = allSubServices.find((s) => s.id === slotModal.subserviceId);
    const pkgName = (sub && sub.hasPackages && selectedPackage) ? selectedPackage : undefined;

    const result = await addToCart(slotModal.subserviceId, 1, date, slot, pkgName);
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

  const handleRemoveFromCart = async (subserviceId: string) => {
    const currentQty = cartMap[subserviceId] || 0;
    if (currentQty > 0) await updateQuantity(subserviceId, currentQty - 1);
  };

  const handleUpdateQuantity = useCallback(
    async (subserviceId: string, delta: number) => {
      const currentQty = cartMap[subserviceId] || 0;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        await updateQuantity(subserviceId, 0);
      } else if (currentQty === 0) {
        await handleAddToCart(subserviceId);
      } else {
        await updateQuantity(subserviceId, newQty);
      }
    },
    [cartMap, updateQuantity, handleAddToCart]
  );

  const handleServiceSelect = (serviceId: string) => {
    setActiveServiceId(serviceId);
    setSelectedSubId(null);
  };

  // When a group tab is clicked, update group and default tier (which is "all" by default)
  const handleGroupSelect = (group: string) => {
    setActiveGroup(group);
    setActiveTier("all");
    // Also reset sidebar to show all
    setActiveServiceId("all");
    setSelectedSubId(null);
    router.push(`/beauty/${gender}/${group}`);
  };

  const handleTierSelect = (tierId: string) => {
    const nextTier = activeTier === tierId ? "all" : tierId;
    setActiveTier(nextTier);
    setSelectedSubId(null);
    if (nextTier === "all") {
      router.push(`/beauty/${gender}/${activeGroup}`);
    } else {
      router.push(`/beauty/${gender}/${activeGroup}/${nextTier}`);
    }
  };



  // Tier definitions (as specified)
  const TIERS = [
    { id: "luxe", label: "Luxe", desc: "Curated essentials" },
    { id: "premium", label: "Premium", desc: "Top-tier services" },
  ];

  // Spa sub-tier definitions (as specified, styled same as Luxe and Premium)
  const SPA_TIERS = [
    { id: "ayurveda", label: "Ayurveda", desc: "Traditional therapies" },
    { id: "luxe", label: "Luxe", desc: "Curated relaxation" },
    { id: "prime", label: "Prime", desc: "Top-tier massage" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Centered Title & Search Header */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-8 pt-8 pb-10 space-y-6 text-center">
        <div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            {activeServiceName}
          </h1>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-1.5">
            {gender === "female" ? "For Women" : "For Men"} ·{" "}
            {filteredSubs.length} service{filteredSubs.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Large Search Input */}
        <div className="relative max-w-4xl mx-auto h-12 rounded-2xl border border-gray-200 bg-white shadow-sm flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search in ${activeServiceName}...`}
            className="w-full h-full pl-12 pr-4 bg-transparent focus:outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-[1600px] w-full px-4 sm:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

          {/* ── Sidebar ── */}
          <aside className="hidden lg:block col-span-1 lg:col-span-3 shrink-0">
            <div className="sticky top-[120px]">
              <div className="bg-white lg:rounded-3xl p-4 lg:p-5 shadow-sm border border-gray-100">
                <h2 className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 lg:mb-4 px-1">
                  Beauty &amp; Wellness
                </h2>

                <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible no-scrollbar">
                  {/* All Services */}
                  <button
                    onClick={() => handleServiceSelect("all")}
                    className={`flex lg:w-full items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl lg:rounded-2xl transition-all border text-left group shrink-0 lg:shrink ${activeServiceId === "all"
                      ? "bg-indigo-50 border-indigo-200"
                      : "bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
                      }`}
                  >
                    <div className="relative w-8 h-8 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl overflow-hidden shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
                      <LayoutGrid
                        className={`w-4 h-4 lg:w-6 lg:h-6 transition-colors ${activeServiceId === "all"
                          ? "text-indigo-500"
                          : "text-gray-400 group-hover:text-indigo-500"
                          }`}
                      />
                    </div>
                    <div className="lg:flex-1 min-w-0 pr-2 lg:pr-0">
                      <h4
                        className={`text-xs lg:text-sm font-semibold truncate ${activeServiceId === "all"
                          ? "text-indigo-900"
                          : "text-gray-900"
                          }`}
                      >
                        All Services
                      </h4>
                      <p className="hidden lg:block text-xs font-medium text-gray-500 mt-0.5">
                        View full catalog
                      </p>
                    </div>
                    <ChevronRight
                      className={`hidden lg:block w-4 h-4 shrink-0 transition-transform ${activeServiceId === "all"
                        ? "text-indigo-600 translate-x-1"
                        : "text-gray-300 group-hover:translate-x-1"
                        }`}
                    />
                  </button>

                  {/* Skeleton while loading */}
                  {loading &&
                    [1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 animate-pulse p-3 bg-gray-50 rounded-2xl"
                      >
                        <div className="w-14 h-14 bg-gray-100 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                          <div className="h-2 bg-gray-100 rounded w-1/2" />
                        </div>
                      </div>
                    ))}

                  {/* Real services from API */}
                  {!loading &&
                    visibleSidebarServices.map((svc) => {
                      const isActive = activeServiceId === svc.id;
                      return (
                        <button
                          key={svc.id}
                          onClick={() => handleServiceSelect(svc.id)}
                          className={`flex lg:w-full items-center gap-2 lg:gap-3 p-2 lg:p-3 rounded-xl lg:rounded-2xl transition-all border text-left group shrink-0 lg:shrink ${isActive
                            ? "bg-indigo-50 border-indigo-200"
                            : "bg-white border-gray-100 hover:border-indigo-200 hover:bg-gray-50"
                            }`}
                        >
                          <div className="relative w-8 h-8 lg:w-14 lg:h-14 rounded-lg lg:rounded-xl overflow-hidden shrink-0 border border-gray-100 bg-gray-50">
                            {svc.image && svc.image !== "/images/services/placeholder.png" ? (
                              <img
                                src={svc.image}
                                alt={svc.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">
                                {svc.name?.[0] || "S"}
                              </div>
                            )}
                          </div>
                          <div className="lg:flex-1 min-w-0 pr-2 lg:pr-0">
                            <h4
                              className={`text-xs lg:text-sm font-semibold truncate ${isActive ? "text-indigo-900" : "text-gray-900"
                                }`}
                            >
                              {svc.name}
                            </h4>
                            <p className="hidden lg:block text-xs font-medium text-gray-500 mt-0.5">
                              Starts at ₹{svc.minPrice}
                            </p>
                          </div>
                          <ChevronRight
                            className={`hidden lg:block w-4 h-4 shrink-0 transition-transform ${isActive
                              ? "text-indigo-600 translate-x-1"
                              : "text-gray-300 group-hover:translate-x-1"
                              }`}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </aside>

          {/* ── Middle Column (Service Cards list) ── */}
          <div className="col-span-1 lg:col-span-5 space-y-4">

            {/* Package selector chips */}
            {availablePackages.length > 0 && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar py-1">
                {availablePackages.map((pkgName) => {
                  const isActive = selectedPackage === pkgName;
                  const IconComponent = PACKAGE_ICONS[pkgName.toLowerCase()];
                  return (
                    <button
                      key={pkgName}
                      onClick={() => setSelectedPackage(pkgName)}
                      className={`shrink-0 flex items-center gap-2 px-4.5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 whitespace-nowrap border-2 ${isActive
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/20"
                        }`}
                    >
                      {IconComponent && (
                        <IconComponent className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-indigo-500"}`} />
                      )}
                      <span>{pkgName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mobile service select */}
            <div className="lg:hidden mb-4">
              <select
                value={activeServiceId}
                onChange={(e) => handleServiceSelect(e.target.value)}
                className="w-full text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-2.5 outline-none"
              >
                <option value="all">All Services</option>
                {visibleSidebarServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading */}
            {loading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl p-6 border border-gray-100 animate-pulse"
                  >
                    <div className="flex gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="h-5 bg-gray-100 rounded w-3/4" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-20 bg-gray-100 rounded w-full" />
                      </div>
                      <div className="w-32 h-32 bg-gray-100 rounded-2xl" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-red-200">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                <p className="font-bold text-red-500">{error}</p>
              </div>
            )}

            {/* Sub-service list */}
            {!loading && !error && filteredSubs.length > 0 && (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredSubs.map((sub) => (
                    <ServiceCard
                      key={sub.id}
                      sub={sub}
                      cartQuantity={cartMap[sub.id] || 0}
                      isSelected={selectedSubId === sub.id}
                      onSelect={() => setSelectedSubId(sub.id)}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Empty */}
            {!loading && !error && filteredSubs.length === 0 && (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-6 h-6 text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  No services found
                </h3>
                <p className="text-sm font-medium text-gray-400 mt-2">
                  Try adjusting your search or select a different service.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    handleServiceSelect("all");
                  }}
                  className="mt-5 px-6 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* ── Right Column: Detail Panel ── */}
          <div className="col-span-1 lg:col-span-4 sticky top-[100px]">
            <ServiceDetailPreview
              selectedSubService={selectedSubService}
              cart={cartMap}
              onUpdateQuantity={handleUpdateQuantity}
              formatImageUrl={resolveImage}
            />
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {showLoginModal && (
        <LoginModal onClose={() => setShowLoginModal(false)} />
      )}

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
                  <h3 className="text-xl font-black text-gray-800 text-center mb-2">
                    No Providers Available
                  </h3>
                  <p className="text-gray-500 text-sm text-center leading-relaxed">
                    Sorry,{" "}
                    <span className="font-bold text-gray-700">
                      {noProviderModal.serviceName}
                    </span>{" "}
                    doesn&apos;t have any verified providers serving{" "}
                    <span className="font-bold text-indigo-600">
                      {noProviderModal.location}
                    </span>{" "}
                    at the moment.
                  </p>
                  <button
                    onClick={() => setNoProviderModal(null)}
                    className="mt-6 w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-colors"
                  >
                    Got it
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

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

export default BeautyCatalogPage;
