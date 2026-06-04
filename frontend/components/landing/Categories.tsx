"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CategoryModal from "./CategoryModal";
import { API_URL } from "@/config/api";

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
      whileHover={{ y: -6, scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="relative w-[140px] h-[160px] flex-none group perspective-1000"
    >
      <motion.div
        className="relative w-full h-full transition-all duration-500 preserve-3d group-hover:[transform:rotateY(180deg)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Face */}
        <div className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center gap-3 rounded-2xl border p-4 transition-all duration-300 ${isActive
          ? "border-[#1D2B83] bg-[#1D2B83] text-white shadow-lg"
          : "border-white bg-white text-slate-600 shadow-sm"
          }`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className={`rounded-xl p-2 transition-all duration-300 ${isActive ? "bg-white/20" : "bg-slate-50"}`}>
            <img src={cat.image} alt={cat.name} className="h-10 w-10 object-contain" />
          </div>
          <span className="text-[10px] font-black uppercase text-center leading-tight break-words">
            {cat.name}
          </span>
        </div>

        {/* Back Face */}
        <div className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center p-4 rounded-2xl border rotate-y-180 ${isActive
          ? "border-[#1D2B83] bg-white text-[#1D2B83]"
          : "border-[#1D2B83] bg-[#1D2B83] text-white shadow-xl"
          }`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="text-[8px] font-black uppercase tracking-[0.05em] text-center line-clamp-4">
            {cat.label}
          </span>
          <div className="mt-2 h-0.5 w-8 bg-current opacity-30 rounded-full" />
        </div>
      </motion.div>
    </motion.button>
  );
};

const Categories = () => {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_URL}/categories`);
        const data = await response.json();
        
        const mappedCategories: Category[] = Array.isArray(data) 
          ? data.map((cat: any) => ({
              id: cat._id?.toString() || Math.random().toString(),
              name: cat.category_name,
              image: cat.icon,
              label: cat.description || "SERVICE",
            }))
          : [];
        
        setCategories(mappedCategories);
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

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
    if (category.redirectPath) {
      router.push(category.redirectPath);
      return;
    }

    // Fetch services for this category to populate groups
    try {
      const response = await fetch(`${API_URL}/services?category_id=${category.id}`);
      const servicesData = await response.json();

      // Create a group for the fetched services
      const categoryWithServices: Category = {
        ...category,
        groups: [
          {
            title: "",
            services: servicesData.map((s: any) => ({
              id: s._id,
              name: s.service_name,
              image: s.image
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

  if (loading) {
    return (
      <div className="bg-[#F5F2FB] py-16 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]"></div>
      </div>
    );
  }

  return (
    <section className="bg-[#F5F2FB] py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-8 sm:mb-12"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight mb-2 text-center">
            What do you need help with?
          </h2>
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="h-1 sm:h-1.5 w-20 bg-[#1D2B83] rounded-full origin-left"
          />
        </motion.div>

        {/* Categories Scrollable Container with Auto-scroll */}
        <div className="relative group/marquee px-2 sm:px-0">
          {/* Manual Scroll Buttons - Hidden on very small screens for cleaner UI */}
          <button
            onClick={() => scroll("left")}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg text-[#1D2B83] transition-all hover:bg-[#1D2B83] hover:text-white -left-6 border border-slate-100"
            aria-label="Scroll Left"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button
            onClick={() => scroll("right")}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-lg text-[#1D2B83] transition-all hover:bg-[#1D2B83] hover:text-white -right-6 border border-slate-100"
            aria-label="Scroll Right"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div 
            ref={scrollRef}
            className="relative overflow-hidden marquee-container"
          >
            <div className={`flex w-max animate-marquee ${isModalOpen ? "pause-animation" : ""}`}>
              {/* We use 3 sets to ensure there is never a break even on large screens or during resets */}
              {[1, 2, 3].map((setNum) => (
                <div key={`set-${setNum}`} className="flex gap-8 pr-8 py-4">
                  {categories.map((cat, index) => (
                    <CategoryCard 
                      key={`set${setNum}-${cat.id}-${index}`} 
                      cat={cat} 
                      index={index} 
                      isActive={selectedCategory?.id === cat.id}
                      onClick={() => handleCategoryClick(cat)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Fade effects on sides */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#F5F2FB] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#F5F2FB] to-transparent z-10 pointer-events-none" />
        </div>

        {/* View More Button */}
        <div className="mt-12 flex justify-center">
          <Link href="/services">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group flex items-center gap-3 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#1D2B83] shadow-md transition-all hover:bg-[#1D2B83] hover:text-white"
            >
              View All Services
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Selection Modal */}
      {selectedCategory && (
        <CategoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          categoryName={selectedCategory.name}
          serviceGroups={selectedCategory.groups || []}
        />
      )}
    </section>
  );
};

export default Categories;
