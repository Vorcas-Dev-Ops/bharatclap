"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronRight,
  Home,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CategoryModal from "./CategoryModal";
import { BeautyWellnessModal } from "./BeautyWellnessModal";
import { API_URL } from "@/config/api";
import { useHomeData } from "@/hooks/useHomeData";
import CategoryIcon from "@/components/common/CategoryIcon";

interface Category {
  id: string;
  name: string;
  image: string;
  label: string;
  redirectPath?: string;
  groups?: {
    title: string;
    services: {
      id: string;
      name: string;
      image: string;
    }[];
  }[];
}



interface CategoryCardProps {
  cat: Category;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const CategoryCard = ({ cat, index, isActive, onClick }: CategoryCardProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group flex flex-col items-center text-center cursor-pointer w-full focus:outline-none"
    >
      {/* Icon only — larger size with subtle hover animation */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
        <CategoryIcon
          icon={cat.image}
          name={cat.name}
          size={120}
          className="w-full h-full object-contain text-slate-700 stroke-[1.8]"
        />
      </div>

      {/* Category title below the icon */}
      <span
        className={`mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-[15px] font-semibold leading-snug transition-colors text-center line-clamp-2 w-full max-w-[120px] sm:max-w-[140px] md:max-w-[155px] ${
          isActive ? "text-[#1D2B83] font-bold" : "text-neutral-900 group-hover:text-[#1D2B83]"
        }`}
      >
        {cat.name}
      </span>
    </motion.button>
  );
};

const Categories = () => {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBeautyModalOpen, setIsBeautyModalOpen] = useState(false);

  // Load fresh categories from BFF (/api/customer/home)
  const { categories: bffCategories, loading: homeLoading } = useHomeData();

  const categories: Category[] = useMemo(() => {
    if (!Array.isArray(bffCategories)) return [];
    return bffCategories.map((cat: any) => ({
      id: cat._id?.toString() || cat.id?.toString() || cat.category_name || cat.name || "",
      name: cat.category_name || cat.name,
      image: cat.icon || cat.image || '',
      label: cat.description || "SERVICE",
    }));
  }, [bffCategories]);

  useEffect(() => {
    // Listen for custom event from PromoBanners
    const handleOpenCategoryModal = (event: CustomEvent) => {
      const categorySlugOrUrl = event.detail.url; // e.g., "/services/bulk-booking"
      
      let targetCat = null;
      if (categorySlugOrUrl.includes("bulk-booking") || categorySlugOrUrl.includes("bulk-ordering")) {
        targetCat = categories.find(c => c.name.toLowerCase().includes("bulk"));
      } else if (categorySlugOrUrl.includes("loan") || categorySlugOrUrl.includes("emi")) {
        targetCat = categories.find(c => c.name.toLowerCase().includes("loan") || c.name.toLowerCase().includes("emi"));
      }

      if (targetCat) {
        handleCategoryClick(targetCat);
      }
    };

    window.addEventListener("openCategoryModal", handleOpenCategoryModal as EventListener);
    
    return () => {
      window.removeEventListener("openCategoryModal", handleOpenCategoryModal as EventListener);
    };
  }, [categories]);

  const handleCategoryClick = async (category: Category) => {
    if (category.name === "Beauty & Wellness") {
      setIsBeautyModalOpen(true);
      return;
    }

    if (category.redirectPath) {
      router.push(category.redirectPath);
      return;
    }

    // Fetch services for this category to populate groups
    try {
      const response = await fetch(`${API_URL}/services?category_id=${category.id}`);
      const servicesData = await response.json();

      const rawList = Array.isArray(servicesData) ? servicesData : (servicesData?.data || []);
      const categoryWithServices: Category = {
        ...category,
        groups: [
          {
            title: "",
            services: rawList.map((s: any) => ({
              id: s._id || s.id,
              name: s.service_name || s.name,
              image: s.image || (Array.isArray(s.images) && s.images[0]) || s.imageUrl || s.category_icon || category.image || ""
            }))
          }
        ]
      };

      setSelectedCategory(categoryWithServices);
      setIsModalOpen(true);
    } catch (error) {
      console.error("Error fetching services for category:", error);
      // Fallback: show empty modal or handle error
      setSelectedCategory(category);
      setIsModalOpen(true);
    }
  };

  // Show simple loading state until latest icons from Admin are ready — never show old/default icons
  const isLoading = homeLoading || categories.length === 0;

  if (isLoading) {
    return (
      <section className="relative bg-white py-14 sm:py-20 overflow-hidden">
        <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4">
          {/* Heading */}
          <div className="text-center mb-10 sm:mb-14">
            <div className="inline-flex items-center gap-2 bg-slate-50 rounded-full px-3.5 py-1.5 mb-4 border border-slate-200/60">
              <Home className="w-3.5 h-3.5 text-[#1D2B83]" />
              <span className="text-[11px] font-bold text-[#1D2B83] uppercase tracking-widest">Serving Bengaluru · Our Services</span>
              <Sparkles className="w-3 h-3 text-amber-500" />
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Home Services at{" "}
              <span className="relative inline-block text-[#1D2B83]">
                Your Doorstep
              </span>
            </h2>

            <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
              Expert professionals, one tap away. Available across Bengaluru — we bring trusted services right to your home.
            </p>
          </div>

          {/* Simple skeleton placeholders */}
          <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-8 md:gap-x-6 md:gap-y-10 w-full mx-auto animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="w-[calc(50%-12px)] min-[480px]:w-[calc(33.333%-16px)] sm:w-[130px] md:w-[150px] lg:w-[160px] flex flex-col items-center"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-slate-100" />
                <div className="mt-2.5 sm:mt-3 h-3.5 sm:h-4 w-20 sm:w-24 bg-slate-100 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="relative bg-white py-14 sm:py-20 overflow-hidden">
      <div className="relative w-full max-w-7xl mx-auto px-2 sm:px-4">
        {/* Heading section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-14"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 bg-slate-50 rounded-full px-3.5 py-1.5 mb-4 border border-slate-200/60">
            <Home className="w-3.5 h-3.5 text-[#1D2B83]" />
            <span className="text-[11px] font-bold text-[#1D2B83] uppercase tracking-widest">Serving Bengaluru · Our Services</span>
            <Sparkles className="w-3 h-3 text-amber-500" />
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Home Services at{" "}
            <span className="relative inline-block text-[#1D2B83]">
              Your Doorstep
            </span>
          </h2>

          <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
            Expert professionals, one tap away. Available across Bengaluru — we bring trusted services right to your home.
          </p>
        </motion.div>

        {/* Responsive dynamic categories layout — adjusts naturally across all screen sizes */}
        <div className="flex flex-wrap items-start justify-center gap-x-3 gap-y-8 sm:gap-x-4 sm:gap-y-8 md:gap-x-6 md:gap-y-10 w-full mx-auto">
          {categories.map((cat, index) => (
            <div
              key={cat.id}
              className="w-[calc(50%-12px)] min-[480px]:w-[calc(33.333%-16px)] sm:w-[130px] md:w-[150px] lg:w-[160px] flex justify-center flex-shrink-0"
            >
              <CategoryCard
                cat={cat}
                index={index}
                isActive={selectedCategory?.id === cat.id}
                onClick={() => handleCategoryClick(cat)}
              />
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 sm:mt-14 flex justify-center"
        >
          <Link href="/services">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 12px 28px -8px rgba(29,43,131,0.3)" }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-3 rounded-full bg-[#1D2B83] px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-[#1D2B83]/20 transition-all hover:bg-[#141f66]"
            >
              Explore All Services
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </Link>
        </motion.div>
      </div>

      {/* Selection Modal */}
      {selectedCategory && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          categoryName={selectedCategory.name}
          categoryIcon={selectedCategory.image}
          serviceGroups={selectedCategory.groups || []}
        />
      )}

      {/* Beauty & Wellness Modal */}
      <BeautyWellnessModal
        isOpen={isBeautyModalOpen}
        onClose={() => setIsBeautyModalOpen(false)}
      />
    </section>
  );
};

export default Categories;
