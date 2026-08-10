import React from 'react';
import Navbar from '@/components/common/Navbar';
import ContactHero from '@/components/contact/ContactHero';
import ContactSection from '@/components/contact/ContactSection';
import Footer from '@/components/common/Footer';

export const metadata = {
  title: 'Contact Us — BharatClap Customer & Business Support',
  description: 'Get in touch with BharatClap support team. Call our official helpline or send an inquiry to our Bengaluru headquarters.',
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />
      <ContactHero />
      <ContactSection />
      <Footer />
    </main>
  );
}
