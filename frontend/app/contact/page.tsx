import React from 'react';
import Navbar from '@/components/common/Navbar';
import ContactHero from '@/components/contact/ContactHero';
import ContactSection from '@/components/contact/ContactSection';
// import ContactMap from '@/components/contact/ContactMap';
import Footer from '@/components/common/Footer';
import StickyNavPill from '@/components/common/StickyNavPill';

export const metadata = {
    title: 'Contact Us | Architectural Service — Bespoke Consultation',
    description:
        'Get in touch with our architectural consultants. Visit our studio in San Francisco, send us a message, or call our direct line for a bespoke consultation.',
};

export default function ContactPage() {
    return (
        <main className="min-h-screen bg-[#f5f5f7]">
            <StickyNavPill />
            <Navbar />
            <ContactHero />
            <ContactSection />
            {/* <ContactMap /> */}
            <Footer />
        </main>
    );
}
