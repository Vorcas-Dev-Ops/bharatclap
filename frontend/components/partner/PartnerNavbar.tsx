"use client";

import React from "react";
import Link from "next/link";
import { useSettings } from "@/context/SettingsContext";

export function PartnerNavbar({ onRegisterClick }: { onRegisterClick: () => void }) {
    const { platformName, platformLogo } = useSettings();
    return (
        <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-[#FCF8FF]/80 backdrop-blur-md">
            <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between px-6">
                <div className="flex items-center">
                    <Link href="/" className="flex items-center gap-2">
                        {platformLogo ? (
                            <div className="w-10 h-10 flex items-center justify-center overflow-hidden mix-blend-multiply">
                                <img src={platformLogo} alt={platformName} className="w-full h-full object-contain" />
                            </div>
                        ) : (
                            <div className="bg-[#1D2B83] p-1 rounded-lg w-9 h-9 flex items-center justify-center overflow-hidden">
                                <span className="text-sm font-black text-white">{platformName.substring(0, 2).toUpperCase()}</span>
                            </div>
                        )}
                        <span className="text-xl font-black text-[#1D2B83] tracking-tighter">{platformName}</span>
                    </Link>
                </div>
                <button
                    onClick={onRegisterClick}
                    className="rounded-xl bg-[#1D2B83] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#16236b] shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                >
                    Register Now
                </button>
            </div>
        </nav>
    );
}
