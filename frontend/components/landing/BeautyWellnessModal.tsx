"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Scissors,
  Flower2,
  Palette,
  Gem,
  Award,
  Crown
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ServiceInfo {
  name: string;
  id: string;
  slug: string;
  description: string;
}

interface GroupInfo {
  name: string;
  description: string;
  icon: any;
  image?: string;
  hasSegments: boolean;
  luxury?: {
    name: string;
    services: ServiceInfo[];
  };
  prime?: {
    name: string;
    services: ServiceInfo[];
  };
  services?: ServiceInfo[];
}

interface GenderInfo {
  name: string;
  description: string;
  groups: Record<string, GroupInfo>;
}

// Complete Hierarchy mapping for navigation and database IDs
const HIERARCHY: Record<string, GenderInfo> = {
  female: {
    name: "Female",
    description: "Salon, Spa, Hair Studio & Makeup",
    groups: {
      salon: {
        name: "Salon",
        description: "Facial, cleanups, waxing, mani-pedi & threading",
        icon: Sparkles,
        image: "/images/categoryModal/salon.jpg",
        hasSegments: true,
        luxury: {
          name: "Luxury",
          services: [
            { name: "Facial & Cleanup", id: "69ddd231787a6cdc5cc8fb30", slug: "facial", description: "Premium facials and cleanups for glow and skin therapy" },
            { name: "Manicure & Pedicure", id: "69ddd231787a6cdc5cc8fb33", slug: "manicure-pedicure", description: "Relaxing hands and feet grooming using organic spa packs" },
            { name: "Waxing", id: "69ddd231787a6cdc5cc8fb32", slug: "waxing", description: "Smooth waxing including honey, rica, and full-body options" }
          ]
        },
        prime: {
          name: "Prime",
          services: [
            { name: "Facial & Cleanup", id: "69ddd231787a6cdc5cc8fb30", slug: "facial", description: "Everyday cleanups and herbal facials for refreshed skin" },
            { name: "Manicure & Pedicure", id: "69ddd231787a6cdc5cc8fb33", slug: "manicure-pedicure", description: "Quick manicure & pedicure with standard grooming products" },
            { name: "Waxing", id: "69ddd231787a6cdc5cc8fb32", slug: "waxing", description: "Essential honey and chocolate waxing services" }
          ]
        }
      },
      spa: {
        name: "Spa",
        description: "Relaxation and pain relief therapies at home",
        icon: Flower2,
        image: "/images/categoryModal/spa.jpg",
        hasSegments: true,
        luxury: {
          name: "Luxury",
          services: [
            { name: "Massage Therapy", id: "69ddd231787a6cdc5cc8fb34", slug: "massage", description: "Deep tissue massage, aromatherapy, and hot stone pampering" }
          ]
        },
        prime: {
          name: "Prime",
          services: [
            { name: "Massage Therapy", id: "69ddd231787a6cdc5cc8fb34", slug: "massage", description: "Classic Swedish and stress relief massages" }
          ]
        }
      },
      'hair-studio': {
        name: "Hair Studio",
        description: "Haircuts, washes, blow dries & styling",
        icon: Scissors,
        image: "/images/categoryModal/hair_studio.jpg",
        hasSegments: false,
        services: [
          { name: "Haircut & Styling", id: "69ddd231787a6cdc5cc8fb31", slug: "hair-cut", description: "Professional haircuts, washes, styling, and blow dry packages" }
        ]
      },
      'makeup-styling': {
        name: "Makeup & Styling",
        description: "Bridal, party makeup, and saree draping",
        icon: Palette,
        image: "/images/categoryModal/makeup.jpg",
        hasSegments: false,
        services: [
          { name: "Makeup & Styling", id: "69ddd231787a6cdc5cc8fb31", slug: "makeup-styling", description: "Glow makeups and hair styling for special occasions" }
        ]
      }
    }
  },
  male: {
    name: "Male",
    description: "Salon & Spa for men",
    groups: {
      salon: {
        name: "Salon",
        description: "Haircuts, shaving, facials & grooming",
        icon: Scissors,
        image: "/images/categoryModal/salon.jpg",
        hasSegments: true,
        luxury: {
          name: "Luxury",
          services: [
            { name: "Facial & Cleanup", id: "69ddd231787a6cdc5cc8fb30", slug: "facial", description: "Premium charcoal/gold facials and luxury grooming packs" }
          ]
        },
        prime: {
          name: "Prime",
          services: [
            { name: "Facial & Cleanup", id: "69ddd231787a6cdc5cc8fb30", slug: "facial", description: "Standard face cleanup and tan removal service" },
            { name: "Waxing", id: "69ddd231787a6cdc5cc8fb32", slug: "waxing", description: "Standard back and shoulder waxing for men" }
          ]
        }
      },
      spa: {
        name: "Spa",
        description: "Stress relief and massage therapies",
        icon: Flower2,
        image: "/images/categoryModal/spa.jpg",
        hasSegments: true,
        luxury: {
          name: "Luxury",
          services: [
            { name: "Massage Therapy", id: "69ddd231787a6cdc5cc8fb34", slug: "massage", description: "Deep tissue pain relief and luxury herbal compress massage" }
          ]
        },
        prime: {
          name: "Prime",
          services: [
            { name: "Massage Therapy", id: "69ddd231787a6cdc5cc8fb34", slug: "massage", description: "Relaxing Swedish massage and express foot reflexology" }
          ]
        }
      }
    }
  }
};

// Aliases for URL matching to support direct navigation with varying slugs
const ALIAS_MAP: Record<string, string> = {
  // Service group aliases
  'haircut-styling': 'hair-studio',
  'hair-cut': 'hair-studio',
  'haircut': 'hair-studio',
  'hair': 'hair-studio',
  'makeup': 'makeup-styling',
  'makeup-&-styling': 'makeup-styling',
  // Service aliases
  'massage-therapy': 'massage',
  'stress-relief': 'massage',
  'pain-relief': 'massage',
  'facial-cleanup': 'facial',
  'facial-&-cleanup': 'facial',
  'manicure-&-pedicure': 'manicure-pedicure',
  'mani-pedi': 'manicure-pedicure'
};

const resolveSlug = (s: string): string => {
  return ALIAS_MAP[s.toLowerCase()] || s;
};

interface BeautyWellnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlug?: string[];
}

export const BeautyWellnessModal: React.FC<BeautyWellnessModalProps> = ({
  isOpen,
  onClose,
  initialSlug = []
}) => {
  const router = useRouter();
  const [slug, setSlug] = useState<string[]>(initialSlug.map(resolveSlug));

  useEffect(() => {
    setSlug(initialSlug.map(resolveSlug));
  }, [initialSlug]);

  const gender = slug[0];
  const group = slug[1];
  const segment = slug[2];

  const hasSegments = gender && group && HIERARCHY[gender]?.groups[group]?.hasSegments;

  // Sync state changes back to URL path shallowly
  const updateUrlPath = (newSlug: string[]) => {
    setSlug(newSlug);
    const path = newSlug.length > 0 ? `/beauty/${newSlug.join("/")}` : "/";
    window.history.pushState(null, "", path);
  };

  const handleGenderSelect = (g: string) => {
    updateUrlPath([g]);
  };

  const handleGroupSelect = (grp: string) => {
    const groupData = HIERARCHY[gender]?.groups[grp];
    if (groupData) {
      if (groupData.hasSegments) {
        updateUrlPath([gender, grp]);
      } else {
        const firstSvc = groupData.services?.[0];
        if (firstSvc) {
          onClose();
          router.push(`/service/${firstSvc.id}`);
        }
      }
    }
  };

  const handleSegmentSelect = (seg: string) => {
    updateUrlPath([gender, group, seg]);
  };

  const handleServiceSelect = (svc: ServiceInfo) => {
    onClose();
    router.push(`/service/${svc.id}`);
  };

  const handleBack = () => {
    if (slug.length === 0) {
      onClose();
    } else if (slug.length === 1) {
      updateUrlPath([]);
    } else if (slug.length === 2) {
      updateUrlPath([gender]);
    } else if (slug.length === 3) {
      updateUrlPath([gender, group]);
    }
  };

  // Close modal behavior
  const handleClose = () => {
    window.history.pushState(null, "", "/");
    onClose();
  };

  // Clickable Breadcrumbs handler
  const handleBreadcrumbClick = (stepIndex: number) => {
    if (stepIndex === -1) {
      updateUrlPath([]);
    } else {
      updateUrlPath(slug.slice(0, stepIndex + 1));
    }
  };

  if (!isOpen) return null;

  // Breadcrumbs text array
  const breadcrumbs = [];
  if (slug.length >= 0) {
    breadcrumbs.push({ name: "Beauty & Wellness", index: -1 });
  }
  if (slug.length >= 1) {
    breadcrumbs.push({ name: gender === "female" ? "Female" : "Male", index: 0 });
  }
  if (slug.length >= 2) {
    const groupName = HIERARCHY[gender]?.groups[group]?.name || group;
    breadcrumbs.push({ name: groupName, index: 1 });
  }
  if (slug.length >= 3) {
    breadcrumbs.push({ name: segment === "luxury" ? "Luxury" : "Prime", index: 2 });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            key="beauty-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[200]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[201] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="bg-gradient-to-tr from-[#FCF8FF] to-white pointer-events-auto w-full max-w-lg rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden relative flex flex-col border border-slate-100/50 z-10"
            >
              {/* Header (Sticky) */}
              <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between z-20 shadow-sm">
                <div className="flex items-center gap-3">
                  {slug.length > 0 && (
                    <button
                      onClick={handleBack}
                      className="p-1.5 hover:bg-slate-50 rounded-full transition-all text-slate-500 hover:text-[#1D2B83]"
                      aria-label="Back"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  )}
                  <h2 className="text-lg font-black text-slate-800 tracking-tight">
                    Beauty & Wellness
                  </h2>
                </div>

                <button
                  onClick={handleClose}
                  className="p-1.5 hover:bg-slate-50 rounded-full transition-all text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Breadcrumbs Banner (Sticky) */}
              <div className="sticky top-[60px] bg-[#FAF6FF] px-6 py-2.5 border-b border-slate-100/60 z-20 overflow-x-auto no-scrollbar shadow-inner">
                <div className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-slate-400">
                  {breadcrumbs.map((b, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
                      <button
                        onClick={() => handleBreadcrumbClick(b.index)}
                        className={`hover:text-[#1D2B83] transition-colors uppercase whitespace-nowrap ${idx === breadcrumbs.length - 1 ? "text-[#1D2B83] font-black" : "font-bold"
                          }`}
                      >
                        {b.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Modal Main Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar max-h-[60vh]">

                {/* Step 0: Gender Selection */}
                {slug.length === 0 && (
                  <div className="flex flex-col justify-center space-y-6">
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">Select Experience</h3>
                      <p className="text-slate-400 text-[10px] font-semibold">Salon & spa services at your convenience.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Female */}
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleGenderSelect("female")}
                        className="cursor-pointer bg-white border border-pink-100 hover:border-pink-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden"
                      >
                        {/* Background Image */}
                        <img
                          src="/images/women_grooming.png"
                          alt="Women Grooming"
                          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 pointer-events-none z-0"
                        />

                        {/* Light gradient mask to ensure text readability */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent z-10 pointer-events-none group-hover:from-white/90 transition-all duration-300" />

                        <div className="h-10 w-10 rounded-xl bg-pink-50/90 flex items-center justify-center text-pink-500 relative z-20 shadow-sm">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5 relative z-20">
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-pink-600 transition-colors">For Women</h4>
                          <p className="text-slate-600 text-[9px] font-bold leading-tight">Salon, Spa, Hair & Makeup.</p>
                        </div>
                      </motion.div>
                      {/* Male */}
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleGenderSelect("male")}
                        className="cursor-pointer bg-white border border-indigo-100 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden"
                      >
                        {/* Background Image */}
                        <img
                          src="/images/men_grooming.png"
                          alt="Men Grooming"
                          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 pointer-events-none z-0"
                        />

                        {/* Light gradient mask to ensure text readability */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent z-10 pointer-events-none group-hover:from-white/90 transition-all duration-300" />

                        <div className="h-10 w-10 rounded-xl bg-indigo-50/90 flex items-center justify-center text-indigo-500 relative z-20 shadow-sm">
                          <Crown className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5 relative z-20">
                          <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">For Men</h4>
                          <p className="text-slate-600 text-[9px] font-bold leading-tight">Salon & Spa treatments.</p>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Step 1: Service Group Selection */}
                {slug.length === 1 && HIERARCHY[gender] && (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#1D2B83]">{gender} services</span>
                      <h3 className="text-lg font-black text-slate-800">Select Service Group</h3>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {Object.entries(HIERARCHY[gender].groups).map(([groupKey, groupInfo]) => {
                        const GroupIcon = groupInfo.icon;
                        return (
                          <motion.div
                            key={groupKey}
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleGroupSelect(groupKey)}
                            className="cursor-pointer bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-100 hover:border-[#1D2B83]/20 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center text-center gap-2 group min-h-[105px]"
                          >
                            <div className="h-12 w-12 rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center transition-all flex-shrink-0 group-hover:scale-105 group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100/50">
                              {groupInfo.image ? (
                                <img
                                  src={groupInfo.image}
                                  alt={groupInfo.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <GroupIcon className="w-5 h-5 text-slate-400 group-hover:text-[#1D2B83] transition-colors" />
                              )}
                            </div>
                            <h4 className="text-[10px] font-extrabold text-slate-700 group-hover:text-[#1D2B83] transition-colors leading-tight line-clamp-2">
                              {groupInfo.name}
                            </h4>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2: Segment Selection (Luxury / Prime, Salon and Spa only) */}
                {slug.length === 2 && HIERARCHY[gender]?.groups[group] && HIERARCHY[gender].groups[group].hasSegments && (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#1D2B83]">{gender} &gt; {group}</span>
                      <h3 className="text-lg font-black text-slate-800">Choose Tier Segment</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Luxury */}
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        onClick={() => handleSegmentSelect("luxury")}
                        className="cursor-pointer bg-amber-50/10 p-5 rounded-2xl border border-amber-100 hover:border-amber-300 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden"
                      >
                        {/* Animated Background Image */}
                        <motion.img
                          src="/images/luxury_class.png"
                          alt="Luxury Class Background"
                          className="absolute inset-0 w-full h-full object-cover -z-20 pointer-events-none opacity-60 group-hover:opacity-65 transition-opacity duration-500"
                          animate={{
                            scale: [1.08, 1.16, 1.08],
                            x: [0, -4, 0],
                            y: [0, -2, 0]
                          }}
                          transition={{
                            duration: 18,
                            ease: "easeInOut",
                            repeat: Infinity,
                          }}
                        />
                        {/* Gradient Overlay for text legibility and premium feel */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-50/75 via-white/85 to-white/90 -z-10 group-hover:from-amber-50/65 group-hover:via-white/75 group-hover:to-white/85 transition-colors duration-500" />

                        <div className="h-10 w-10 rounded-xl bg-amber-50/90 backdrop-blur-sm flex items-center justify-center text-amber-600 shadow-sm">
                          <Gem className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-800 group-hover:text-amber-700 transition-colors">Luxury </h4>
                            {/* <span className="bg-amber-100 text-amber-800 text-[6px] font-black uppercase px-1 rounded-full">VIP</span> */}
                          </div>
                          {/* <p className="text-slate-400 text-[9px] font-medium leading-tight">Top-tier experts & global brands.</p> */}
                        </div>
                      </motion.div>
                      {/* Prime */}
                      <motion.div
                        whileHover={{ y: -4, scale: 1.02 }}
                        onClick={() => handleSegmentSelect("prime")}
                        className="cursor-pointer bg-slate-50/10 p-5 rounded-2xl border border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden"
                      >
                        {/* Animated Background Image */}
                        <motion.img
                          src="/images/prime_class.png"
                          alt="Prime Class Background"
                          className="absolute inset-0 w-full h-full object-cover -z-20 pointer-events-none opacity-60 group-hover:opacity-65 transition-opacity duration-500"
                          animate={{
                            scale: [1.08, 1.16, 1.08],
                            x: [0, 4, 0],
                            y: [0, 2, 0]
                          }}
                          transition={{
                            duration: 18,
                            ease: "easeInOut",
                            repeat: Infinity,
                          }}
                        />
                        {/* Gradient Overlay for text legibility and clean feel */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/75 via-white/85 to-white/90 -z-10 group-hover:from-slate-50/65 group-hover:via-white/75 group-hover:to-white/85 transition-colors duration-500" />

                        <div className="h-10 w-10 rounded-xl bg-slate-50/90 backdrop-blur-sm flex items-center justify-center text-slate-600 shadow-sm">
                          <Award className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-800 group-hover:text-[#1D2B83] transition-colors">Prime </h4>
                            {/* <span className="bg-slate-100 text-slate-800 text-[6px] font-black uppercase px-1 rounded-full">VALUE</span> */}
                          </div>
                          {/* <p className="text-slate-400 text-[9px] font-medium leading-tight">Hygienic daily essentials.</p> */}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* Step 3: Service Selection (For Segmented Salon/Spa) */}
                {slug.length === 3 && HIERARCHY[gender]?.groups[group] && HIERARCHY[gender].groups[group].hasSegments && (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#1D2B83]">{gender} &gt; {group} &gt; {segment}</span>
                      <h3 className="text-lg font-black text-slate-800">Select Service</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(HIERARCHY[gender].groups[group] as any)[segment]?.services.map((svc: ServiceInfo) => (
                        <motion.div
                          key={svc.slug}
                          whileHover={{ y: -2 }}
                          onClick={() => handleServiceSelect(svc)}
                          className="cursor-pointer bg-white p-4 rounded-xl border border-slate-100 hover:border-[#1D2B83]/20 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                        >
                          <div className="space-y-0.5 pr-2">
                            <h4 className="text-xs font-bold text-slate-800 group-hover:text-[#1D2B83] transition-colors leading-none">{svc.name}</h4>
                            <p className="text-slate-400 text-[9px] leading-tight line-clamp-1">{svc.description}</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-slate-300" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
