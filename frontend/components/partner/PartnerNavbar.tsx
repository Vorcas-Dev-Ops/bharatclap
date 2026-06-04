"use client";

import React from "react";
import Link from "next/link";

export function PartnerNavbar({ onRegisterClick }: { onRegisterClick: () => void }) {
    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-[#FCF8FF]/80 backdrop-blur-md">
            <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center">
                    <Link href="/" className="text-xl font-black tracking-tight text-[#1D2B83]">
                        FIXVO
                    </Link>
                </div>
                <div className="hidden md:block">
                </div>
                <button
                    onClick={onRegisterClick}
                    className="rounded-xl bg-[#1D2B83] px-4 py-2 text-sm font-bold text-white hover:bg-[#16236b] transition-colors"
                >
                    Register Now
                </button>
            </div>
        </nav>
    );
}
