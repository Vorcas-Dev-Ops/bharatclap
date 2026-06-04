"use client";

import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import UserHomeCategories from "@/components/categories/UserHomeCategories";

export default function CategoriesPage() {
  return (
    <main className="min-h-screen bg-[#FCF8FF]">
      <Navbar />
      <div className="pt-4 pb-8">
        <UserHomeCategories />
      </div>
      <Footer />
    </main>
  );
}
