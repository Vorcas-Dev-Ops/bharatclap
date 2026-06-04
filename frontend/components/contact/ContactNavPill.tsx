"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Home, Info, Wrench, Mail, CalendarDays } from 'lucide-react';

const navItems = [
    { href: '/', label: 'HOME', icon: Home },
    { href: '/about', label: 'ABOUT', icon: Info },
    { href: '/services', label: 'SERVICES', icon: Wrench },
    { href: '/contact', label: 'CONTACT', icon: Mail },
    { href: '/bookings', label: 'BOOKINGS', icon: CalendarDays },
];

const ContactNavPill = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsVisible(window.scrollY > 400);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] w-full max-w-3xl px-4 transition-all duration-500 transform ${
                isVisible
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-16 opacity-0 pointer-events-none'
            }`}
        >
            <div className="bg-white/90 backdrop-blur-xl border border-gray-100 shadow-xl shadow-black/10 rounded-full py-3 px-6">
                <nav className="flex items-center w-full justify-around">
                    {navItems.map(({ href, label, icon: Icon }) => {
                        const isActive = href === '/contact';
                        return (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-200 ${
                                    isActive
                                        ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-500/25'
                                        : 'text-gray-500 hover:text-indigo-600'
                                }`}
                            >
                                <Icon size={14} strokeWidth={2.5} />
                                {label}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </div>
    );
};

export default ContactNavPill;
