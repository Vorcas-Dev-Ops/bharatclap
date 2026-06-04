"use client";

import React from "react";

export function PartnerFooterStrip() {
    return (
        <div className="bg-white border-t border-slate-100 py-6 text-center">
            <p className="text-xs text-slate-400 font-medium">
                © 2025 ArchitecturalService. All rights reserved.{" "}
                <span className="text-[#1D2B83] font-bold cursor-pointer hover:underline">
                    Privacy Policy
                </span>
                {" · "}
                <span className="text-[#1D2B83] font-bold cursor-pointer hover:underline">
                    Terms
                </span>
            </p>
        </div>
    );
}
