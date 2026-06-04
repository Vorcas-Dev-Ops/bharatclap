"use client";

import React, { Suspense } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import StickyNavPill from "@/components/common/StickyNavPill";
import ServicesListing from "@/components/services/ServicesListing";

const ServicesPage = () => {
  return (
    <main className="min-h-screen bg-[#FCF8FF]">
      <Navbar />
      <StickyNavPill />
      
      <Suspense fallback={
        <div className="min-h-screen bg-[#FCF8FF] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#1D2B83] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <ServicesListing />
      </Suspense>

      <Footer />
    </main>
  );
};

export default ServicesPage;
