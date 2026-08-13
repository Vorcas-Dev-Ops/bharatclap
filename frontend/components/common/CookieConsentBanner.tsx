"use client";

/* ponytail: minimal DPDP cookie & tracker consent banner with zero external deps */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Cookie, Check, X, Settings } from "lucide-react";

export interface CookiePreferences {
  essential: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
    timestamp: "",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("dpdp_consent_preferences");
      if (!stored) {
        setShowBanner(true);
      } else {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
        applyTrackerSettings(parsed);
      }
    } catch {
      setShowBanner(true);
    }
  }, []);

  const applyTrackerSettings = (prefs: CookiePreferences) => {
    // Gate non-essential analytics & marketing scripts per DPDP rules
    if (typeof window !== "undefined") {
      (window as any).dpdpConsentGranted = prefs;
      if (prefs.analytics) {
        console.log("[DPDP] Analytics trackers enabled by user consent.");
      } else {
        console.log("[DPDP] Non-essential analytics trackers gated.");
      }
    }
  };

  const handleSave = (analytics: boolean, marketing: boolean) => {
    const newPrefs: CookiePreferences = {
      essential: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    try {
      localStorage.setItem("dpdp_consent_preferences", JSON.stringify(newPrefs));
    } catch (e) {
      console.warn("Could not save cookie preferences", e);
    }
    setPreferences(newPrefs);
    applyTrackerSettings(newPrefs);
    setShowBanner(false);
    setShowPreferences(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-2xl border border-slate-800 space-y-4">
        
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider">Privacy &amp; Cookie Consent</span>
          </div>
          <button
            onClick={() => handleSave(false, false)}
            className="text-slate-400 hover:text-white p-1"
            title="Dismiss & Reject Non-Essential"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <p className="text-xs text-slate-300 leading-relaxed">
          We use essential cookies to run our platform and doorstep services. Non-essential analytics and marketing trackers are disabled by default under India&apos;s <strong>DPDP Act 2023</strong> until you grant explicit consent.
        </p>

        {showPreferences && (
          <div className="p-3 bg-slate-800 rounded-2xl space-y-2 border border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span>Essential Cookies (Required for booking &amp; auth)</span>
              <span className="text-emerald-400 font-bold">Always On</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Analytics &amp; Usage Diagnostics</span>
              <input
                type="checkbox"
                checked={preferences.analytics}
                onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </div>
            <div className="flex items-center justify-between">
              <span>Marketing &amp; Offer Personalization</span>
              <input
                type="checkbox"
                checked={preferences.marketing}
                onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Link
            href="/privacy"
            className="text-[11px] text-slate-400 hover:text-white underline"
          >
            Privacy Notice
          </Link>

          <div className="flex items-center gap-2">
            {!showPreferences ? (
              <>
                <button
                  onClick={() => handleSave(false, false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                >
                  Reject Non-Essential
                </button>
                <button
                  onClick={() => handleSave(true, true)}
                  className="px-4 py-1.5 bg-[#1D2B83] hover:bg-blue-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Accept All
                </button>
              </>
            ) : (
              <button
                onClick={() => handleSave(preferences.analytics, preferences.marketing)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Save Preferences
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
