"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
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
import StickyNavPill from "@/components/common/StickyNavPill";

export default function BeautyPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const handleClose = () => {
    router.push("/");
  };

  return (
    <main className="min-h-screen">
      <StickyNavPill />
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
      <BeautyWellnessModal 
        isOpen={true} 
        initialSlug={slug || []} 
        onClose={handleClose} 
      />
    </main>
  );
}
