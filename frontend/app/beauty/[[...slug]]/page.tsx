"use client";

import React, { use } from "react";
import { BeautyWellnessModal } from "@/components/landing/BeautyWellnessModal";
import Navbar from "@/components/common/Navbar";
import Hero from "@/components/landing/Hero";
import Categories from "@/components/landing/Categories";
import PromoBanners from "@/components/landing/PromoBanners";
import TrustSection from "@/components/landing/TrustSection";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import PartnerSection from "@/components/landing/PartnerSection";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/common/Footer";
import BeautyCatalogPage from "@/components/beauty/BeautyCatalogPage";

export default function BeautyPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = use(params);


  // Resolve slug segments
  const gender = slug?.[0] as "female" | "male" | undefined;
  const group = slug?.[1];
  const segment = slug?.[2];

  // If gender is set → render full catalog page
  if (gender === "female" || gender === "male") {
    return (
      <main className="min-h-screen bg-gray-50">
        <Navbar />
        <BeautyCatalogPage
          gender={gender}
          initialGroup={group}
          initialTier={segment}
        />
        <Footer />
      </main>
    );
  }

  // Otherwise → render landing page with gender-picker modal open
  // onClose just closes the modal (state only). Gender selection uses window.location.href.
  const handleClose = () => {
    // Navigate home when user explicitly dismisses the modal without selecting
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Categories />
      <PromoBanners />
      <TrustSection />
      <HowItWorks />
      <Testimonials />
      <PartnerSection />
      <FAQ />
      <FinalCTA />
      <Footer />
      <BeautyWellnessModal isOpen={true} onClose={handleClose} />
    </main>
  );
}
