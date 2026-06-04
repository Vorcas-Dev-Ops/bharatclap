"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Info, Wrench, Mail, CalendarDays } from 'lucide-react';

const navItems = [
    { href: '/', label: 'HOME', icon: Home },
    { href: '/about', label: 'ABOUT US', icon: Info },
    { href: '/services', label: 'SERVICES', icon: Wrench },
    { href: '/contact', label: 'CONTACT', icon: Mail },
    { href: '/bookings', label: 'MY BOOKINGS', icon: CalendarDays },
];

const StickyNavPill = () => {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY < 200) {
                setIsVisible(false);
            } else {
                setIsVisible(true);
            }
            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <>
            {/* Sticky Floating Nav Pill */}
            <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-4xl px-4 transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-24 opacity-0 pointer-events-none'
                }`}>
                <div className="bg-white/90 backdrop-blur-xl border border-gray-100 shadow-xl shadow-black/10 rounded-full py-3 px-6">
                    <nav className="flex items-center w-full justify-around">
                        {navItems.map(({ href, label, icon: Icon }) => {
                            const isActive = pathname === href;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold tracking-wide transition-all duration-200 ${
                                        isActive
                                            ? 'bg-[#1E3A8A] text-white shadow-md'
                                            : 'text-gray-500 hover:text-blue-900'
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
        </>
    );
};

export default StickyNavPill;
