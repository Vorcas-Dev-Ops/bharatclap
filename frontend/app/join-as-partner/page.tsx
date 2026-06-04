"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { PartnerNavbar } from "@/components/partner/PartnerNavbar";
import { PartnerHero } from "@/components/partner/PartnerHero";
import { PartnerFeatures } from "@/components/partner/PartnerFeatures";
import { PartnerFAQ } from "@/components/partner/PartnerFAQ";
import { PartnerTerms } from "@/components/partner/PartnerTerms";

import { PartnerFooterStrip } from "@/components/partner/PartnerFooter";
import StickyNavPill from '@/components/common/StickyNavPill';
/**
 * JoinAsPartnerPage Layout
 * Extracted into smaller, modular components in @/components/partner/
 * for better maintainability and performance.
 */
export default function JoinAsPartnerPage() {
    const router = useRouter();

    const handleRegisterClick = () => {
        router.push("/signup/verify?role=provider");
    };

    return (
        <div className="min-h-screen bg-[#FCF8FF] font-sans">
            <StickyNavPill />
            {/* Header / Navigation */}
            <PartnerNavbar onRegisterClick={handleRegisterClick} />

            {/* 1. Hero Section */}
            <PartnerHero onRegisterClick={handleRegisterClick} />

            {/* 2. Core Features & Benefits */}
            {/* Includes Sections: Who Can Join, How It Works, Benefits, Documents Required, Testimonials */}
            <PartnerFeatures />

            {/* 4. Terms and Conditions Summary */}
            <PartnerTerms />

            {/* 5. Frequently Asked Questions */}
            <PartnerFAQ />



            {/* 7. Footer Strip */}
            <PartnerFooterStrip />
        </div>
    );
}
