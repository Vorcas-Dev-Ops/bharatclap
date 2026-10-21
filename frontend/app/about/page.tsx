import React from 'react';
import Navbar from '@/components/common/Navbar';
import AboutHero from '@/components/about_us/AboutHero';
import AboutSection from '@/components/about_us/AboutSection';
import Mission from '@/components/about_us/Mission';
import Features from '@/components/about_us/Features';
import CTA from '@/components/about_us/CTA';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'About Us — BharatClap | Our Mission & Story',
  description: 'Learn about BharatClap, our mission, our values, and the expert team behind India\u0027s trusted home services platform.',
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
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
