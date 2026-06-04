import React from 'react';
import Navbar from '@/components/common/Navbar';
import AboutHero from '@/components/about_us/AboutHero';
import AboutSection from '@/components/about_us/AboutSection';
import Mission from '@/components/about_us/Mission';
import Features from '@/components/about_us/Features';
import CTA from '@/components/about_us/CTA';
import Footer from '@/components/common/Footer';
import StickyNavPill from '@/components/common/StickyNavPill';

export const metadata = {
  title: 'About Us | ArchitecturalService - Crafting Your Sanctuary',
  description: 'Learn about ArchitecturalService, our mission, our values, and the expert team behind our premium home services platform.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <StickyNavPill />
      <Navbar />
      <AboutHero />
      <AboutSection />
      <Mission />
      <Features />
      <CTA />
      <Footer />
    </main>
  );
}
