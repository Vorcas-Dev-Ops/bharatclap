"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import CategoryModal from "../landing/CategoryModal";
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
  isActive: boolean;
  onClick: () => void;
}

const CategoryCard = ({ cat, isActive, onClick }: CategoryCardProps) => {
  return (
    <motion.button
      whileHover={{ y: -6, scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      onClick={onClick}
      className="relative w-full aspect-[7/8] flex-none group perspective-1000 max-w-[160px] mx-auto"
    >
      <motion.div
        className="relative w-full h-full transition-all duration-500 preserve-3d group-hover:[transform:rotateY(180deg)]"
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front Face */}
        <div className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center gap-3 rounded-[2rem] border p-4 transition-all duration-300 ${isActive
          ? "border-[#1D2B83] bg-[#1D2B83] text-white shadow-lg"
          : "border-slate-100 bg-white text-slate-600 shadow-sm hover:shadow-md"
          }`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className={`rounded-2xl p-3 transition-all duration-300 ${isActive ? "bg-white/20" : "bg-blue-50/50"}`}>
            <img src={cat.image} alt={cat.name} className="h-12 w-12 object-contain drop-shadow-sm" />
          </div>
          <span className="text-xs font-black uppercase tracking-tight text-center leading-tight break-words">
            {cat.name}
          </span>
        </div>

        {/* Back Face */}
        <div className={`absolute inset-0 backface-hidden flex flex-col items-center justify-center p-4 rounded-[2rem] border rotate-y-180 ${isActive
          ? "border-[#1D2B83] bg-white text-[#1D2B83]"
          : "border-[#1D2B83] bg-[#1D2B83] text-white shadow-xl"
          }`}
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-center line-clamp-4 leading-relaxed">
            {cat.label}
          </span>
          <div className="mt-3 h-1 w-8 bg-current opacity-30 rounded-full" />
        </div>
      </motion.div>
    </motion.button>
  );
};

const UserHomeCategories = () => {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleCategoryClick = async (category: Category) => {
    if (category.redirectPath) {
      router.push(category.redirectPath);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/services?category_id=${category.id}`);
      const servicesData = await response.json();

      const categoryWithServices: Category = {
        ...category,
        groups: [
          {
            title: "Available Services",
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
      setSelectedCategory(category);
      setIsModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center items-center min-h-[30vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#1D2B83]"></div>
      </div>
    );
  }

  return (
    <section className="py-6 sm:py-10">
      <div className="mx-auto max-w-7xl px-1 sm:px-2 lg:px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-12 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mb-4 text-center">
            What do you need help with?
          </h2>
          <p className="text-slate-500 font-medium text-center max-w-xl">
            Select a category below to explore our wide range of professional services tailored for your needs.
          </p>
          <div className="mt-6 h-1.5 w-24 bg-[#1D2B83] rounded-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 justify-items-center"
        >
          {categories.map((cat, index) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="w-full"
            >
              <CategoryCard
                cat={cat}
                isActive={selectedCategory?.id === cat.id}
                onClick={() => handleCategoryClick(cat)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

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

export default UserHomeCategories;
