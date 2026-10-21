"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  PackageCheck,
  CheckCircle2,
  MapPin,
  Phone,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  QrCode,
  Building
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/config/api";

const authHeaders = () => ({
  Authorization: `Bearer ${
    (typeof window !== "undefined" &&
      (localStorage.getItem("token") || localStorage.getItem("jwt"))) ||
    ""
  }`,
  "Content-Type": "application/json",
});

interface CollectionData {
  collection_id: string | null;
  collection_status: "NOT_APPLICABLE" | "PENDING" | "COLLECTED";
  collected_at: string | null;
  collected_by_name: string | null;
  kit_payment_status: string;
  kit_payment_date: string | null;
  access_status?: string;
  settings: {
    location_name: string;
    collection_address: string;
    contact_person: string;
    contact_number: string;
    collection_instructions: string;
    operating_hours: string;
  };
  provider: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function KitCollectionPage() {
  const router = useRouter();
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchCollectionDetails = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const res = await fetch(`${API_URL}/providers/onboarding/kit-collection`, {
        headers: authHeaders(),
      });

      if (res.ok) {
        const json: CollectionData = await res.json();
        setData(json);

        // If kit is not paid, redirect back to kit payment
        if (json.kit_payment_status !== "PAID") {
          router.replace("/provider/onboarding/kit");
          return;
        }

        // If kit is already collected, redirect to access plan (or dashboard if already active)
        if (json.collection_status === "COLLECTED") {
          if (json.access_status === "ACTIVE") {
            router.replace("/provider/dashboard");
            return;
          }
          if (!isSilent) {
            router.replace("/provider/onboarding/access-plan");
            return;
          }
        }
      } else if (res.status === 401) {
        router.replace("/login");
        return;
      }
    } catch (err) {
      console.error("Error fetching kit collection details", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCollectionDetails();

    // Auto-poll every 6 seconds to detect admin confirmation in real time
    const interval = setInterval(() => {
      fetchCollectionDetails(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [fetchCollectionDetails]);

  const handleCopyId = () => {
    if (data?.collection_id) {
      navigator.clipboard.writeText(data.collection_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isCollected = data?.collection_status === "COLLECTED";

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600" />
          <p className="text-slate-500 font-medium text-sm">
            Loading your Kit Collection details…
          </p>
        </div>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    (data?.settings.location_name || "") + " " + (data?.settings.collection_address || "")
  )}`;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* ── STEPPER / PROGRESS HEADER ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="flex items-center gap-2 justify-center py-1 font-bold text-emerald-700">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>1. KYC Approved</span>
          </div>
          <div className="flex items-center gap-2 justify-center py-1 font-bold text-emerald-700">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>2. Kit Paid (₹639)</span>
          </div>
          <div className={`flex items-center gap-2 justify-center py-1 font-black ${
            isCollected ? "text-emerald-700" : "text-amber-700 bg-amber-50 rounded-xl"
          }`}>
            {isCollected ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            )}
            <span>3. Kit Collection</span>
          </div>
          <div className="flex items-center gap-2 justify-center py-1 font-bold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            <span>4. Access Plan</span>
          </div>
        </div>
      </div>

      {/* ── MAIN STATUS BANNER ───────────────────────────────────────────── */}
      {isCollected ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-900/10 relative overflow-hidden"
        >
          <div className="absolute right-4 top-4 opacity-10 pointer-events-none">
            <CheckCircle2 size={220} />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider text-emerald-100 border border-white/20">
              <Sparkles size={14} className="text-emerald-200" />
              Kit Handover Verified
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Provider Kit Collected ✓
            </h1>

            <p className="text-emerald-50 text-sm sm:text-base max-w-xl leading-relaxed">
              Congratulations, <span className="font-bold">{data?.provider.name}</span>! Your BharatClap Professional Starter Kit handover has been confirmed by our operations desk.
            </p>

            <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4 max-w-lg border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-emerald-200 block text-[11px] font-semibold">Collection ID:</span>
                <span className="font-mono font-black text-sm text-white tracking-wider">
                  {data?.collection_id}
                </span>
              </div>
              <div>
                <span className="text-emerald-200 block text-[11px] font-semibold">Collected On:</span>
                <span className="font-semibold text-white">
                  {data?.collected_at ? new Date(data.collected_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) : 'Today'}
                </span>
              </div>
              <div className="sm:col-span-2 pt-1 border-t border-white/10 text-emerald-100 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-300 shrink-0" />
                <span>Verified by: <strong className="text-white">{data?.collected_by_name || 'BharatClap Operations Desk'}</strong></span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => router.push("/provider/onboarding/access-plan")}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-sm rounded-2xl shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <span>Continue to Access Options</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
            <PackageCheck size={220} />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-400/30 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Payment Successful • Kit Collection Pending
              </div>

              <button
                onClick={() => fetchCollectionDetails()}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                Check Status
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Collect Your BharatClap Starter Kit
            </h1>

            <p className="text-indigo-100/90 text-sm max-w-2xl leading-relaxed">
              Your one-time Kit Payment was confirmed. Please visit the designated BharatClap Hub address below and present your unique Collection ID to collect your physical uniform and equipment kit.
            </p>
          </div>
        </div>
      )}

      {/* ── COLLECTION ID TICKET CARD ────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border-2 border-dashed border-amber-400/80 p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <QrCode size={14} className="text-amber-600" />
              Unique Handover Identification
            </span>
            <div className="text-xs text-slate-600 font-medium">
              Show this ID at the collection reception desk:
            </div>
            <div className="text-3xl sm:text-4xl font-mono font-black text-slate-900 tracking-wider">
              {data?.collection_id || "GENERATING…"}
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? "Copied ID!" : "Copy Collection ID"}
            </button>
            <span className="text-[11px] text-slate-400 font-medium">
              Payment Status: <strong className="text-emerald-600">PAID ✓</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── HUB ADDRESS & DETAILS GRID ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Hub Location Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <Building size={18} className="text-blue-600" />
            Collection Center Location
          </div>

          <div className="space-y-2 text-xs">
            <div className="font-bold text-slate-900 text-sm">
              {data?.settings.location_name}
            </div>
            <div className="text-slate-600 leading-relaxed flex items-start gap-2">
              <MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <span>{data?.settings.collection_address}</span>
            </div>
            {data?.settings.operating_hours && (
              <div className="text-slate-600 flex items-center gap-2 pt-1 font-medium">
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span>Operating Hours: <strong>{data.settings.operating_hours}</strong></span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink size={13} />
              Open in Google Maps
            </a>
          </div>
        </div>

        {/* Contact & Support Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
            <Phone size={18} className="text-emerald-600" />
            Hub Contact Details
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-semibold">Contact Person:</span>
              <span className="font-bold text-slate-800 text-sm">
                {data?.settings.contact_person}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-semibold">Contact Phone:</span>
              <a
                href={`tel:${data?.settings.contact_number}`}
                className="font-bold text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1.5"
              >
                <Phone size={13} />
                {data?.settings.contact_number}
              </a>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 leading-normal">
            Need directions or assistance? Call the hub operations desk before visiting.
          </div>
        </div>
      </div>

      {/* ── COLLECTION INSTRUCTIONS ───────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
          <ShieldCheck size={18} className="text-indigo-600" />
          Collection Instructions & Next Steps
        </div>

        <div className="text-xs text-slate-600 leading-relaxed space-y-2">
          {data?.settings.collection_instructions ? (
            <p className="font-medium whitespace-pre-line bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-indigo-950">
              {data.settings.collection_instructions}
            </p>
          ) : (
            <p className="font-medium text-slate-600">
              Please carry your original Aadhaar Card and show your Collection ID at the reception counter. Kit verification and handover takes approximately 5-10 minutes.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                1. Visit Hub
              </span>
              <p className="text-[11px] text-slate-500">
                Arrive during operating hours with your mobile phone.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                2. Show Collection ID
              </span>
              <p className="text-[11px] text-slate-500">
                Present {data?.collection_id} and original Govt ID.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                3. Instant Activation
              </span>
              <p className="text-[11px] text-slate-500">
                Admin confirms handover and your Access Plan options unlock.
              </p>
            </div>
          </div>
        </div>

        {isCollected && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700">
              ✓ Kit Collection Confirmed
            </span>
            <button
              onClick={() => router.push("/provider/onboarding/access-plan")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
            >
              <span>Continue to Access Options</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
