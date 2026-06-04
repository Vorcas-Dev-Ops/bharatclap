"use client";

import React from 'react';
import ContactInfo from './ContactInfo';
import ContactForm from './ContactForm';

const ContactSection = () => {
    return (
        <section className="relative py-4 md:py-12 bg-[#F8FAFF]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                    {/* Left Side – Contact Info + Image */}
                    <ContactInfo />
                    {/* Right Side – Contact Form */}
                    <ContactForm />
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
