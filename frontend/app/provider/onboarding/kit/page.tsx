"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Package,
  ShoppingBag,
  ChevronRight,
  Plus,
  Minus,
  Truck,
  Shield,
  X,
  AlertCircle,
} from "lucide-react";
import Image from "next/image";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface KitItem {
  name: string;
  description: string;
  stock: number;
}
interface KitSize {
  size: string;
  active: boolean;
  stock: number;
}
interface StarterKit {
  _id: string;
  name: string;
  description: string;
  items: KitItem[];
  sizes: KitSize[];
  price: number;
  gst: number;
  delivery: number;
  convenience: number;
  estimatedDays: number;
  shippingPartner: string;
  paymentMandatory: boolean;
  allowRegistrationWithoutPayment: boolean;
  images?: { kit?: string; banner?: string };
}
interface Accessory {
  _id: string;
  title: string;
  description: string;
  image: string;
  price: number;
  gst_percent: number;
  stock: number;
}

const API_URL =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
    : "";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("jwt") || ""}`,
  "Content-Type": "application/json",
});

export default function ProviderKitCheckoutPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [kit, setKit] = useState<StarterKit | null>(null);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsAccessories, setNeedsAccessories] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedSize, setSelectedSize] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [skipError, setSkipError] = useState("");

  // ─── Fetch kit + provider info ──────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [provRes, kitRes] = await Promise.all([
          fetch(`${API_URL}/providers/me`, { headers: authHeaders() }),
          fetch(`${API_URL}/providers/onboarding/starter-kit`, {
            headers: authHeaders(),
          }),
        ]);

        if (provRes.ok) {
          const pd = await provRes.json();
          setProvider(pd);
          if (pd.onboardingCompleted) {
            router.push("/provider/dashboard");
            return;
          }
          if (pd.kyc_status !== "verified") {
            router.push("/provider/pending");
            return;
          }
        }

        if (kitRes.ok) {
          const kd: StarterKit = await kitRes.json();
          setKit(kd);
          if (kd.sizes?.length) {
            const firstActive = kd.sizes.find((s) => s.active);
            if (firstActive) setSelectedSize(firstActive.size);
          }
        }
      } catch (e) {
        console.error("Error fetching onboarding data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // ─── Fetch accessories when checkbox is ticked ───────────────────────────────
  const fetchAccessories = useCallback(async () => {
    if (accessories.length > 0) return; // already loaded
    try {
      const res = await fetch(`${API_URL}/providers/onboarding/accessories`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setAccessories(data.accessories || []);
      }
    } catch (e) {
      console.error("Error fetching accessories", e);
    }
  }, [accessories.length]);

  const handleAccessoriesToggle = (checked: boolean) => {
    setNeedsAccessories(checked);
    if (checked) fetchAccessories();
    if (!checked) setCart({});
  };

  const updateCart = (id: string, delta: number) => {
    setCart((prev) => {
      const next = (prev[id] || 0) + delta;
      if (next <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const totals = (() => {
    if (!kit)
      return {
        kitBase: 0,
        kitGst: 0,
        delivery: 0,
        convenience: 0,
        accSubtotal: 0,
        accGst: 0,
        grand: 0,
      };
    const kitBase = kit.price;
    const kitGst = Math.round(kitBase * (kit.gst / 100));
    const delivery = kit.delivery || 0;
    const convenience = kit.convenience || 0;

    let accSubtotal = 0;
    Object.entries(cart).forEach(([id, qty]) => {
      const acc = accessories.find((a) => a._id === id);
      if (acc) accSubtotal += acc.price * qty;
    });
    const accGst = Math.round(accSubtotal * 0.18);
    const grand =
      kitBase + kitGst + delivery + convenience + accSubtotal + accGst;
    return {
      kitBase,
      kitGst,
      delivery,
      convenience,
      accSubtotal,
      accGst,
      grand,
    };
  })();

  // ─── Payment ────────────────────────────────────────────────────────────────
  const handlePayment = async () => {
    if (!kit || !termsAccepted) return;
    setSubmitting(true);
    try {
      const accItems = Object.entries(cart).map(([id, qty]) => {
        const acc = accessories.find((a) => a._id === id)!;
        return {
          accessory_id: id,
          name: acc.title,
          quantity: qty,
          unit_price: acc.price,
        };
      });

      const orderRes = await fetch(
        `${API_URL}/providers/onboarding/create-order`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            kitId: kit._id,
            kitSize: selectedSize,
            accessories: accItems,
          }),
        },
      );

      if (!orderRes.ok) throw new Error("Failed to create order");
      const orderData = await orderRes.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BharatClap",
        description: `Provider Kit${accItems.length ? " + Accessories" : ""}`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          const verifyRes = await fetch(
            `${API_URL}/providers/onboarding/verify-payment`,
            {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                dbOrderId: orderData.dbOrderId,
              }),
            },
          );
          if (verifyRes.ok) router.push("/provider/onboarding/payment-success");
          else alert("Payment verification failed. Please contact support.");
        },
        prefill: {
          name: provider?.user_id?.name || "",
          email: provider?.user_id?.email || "",
          contact: provider?.user_id?.phone || "",
        },
        theme: { color: "#1D2B83" },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (r: any) =>
        alert("Payment Failed: " + r.error.description),
      );
      rzp.open();
    } catch (e: any) {
      alert(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Skip ────────────────────────────────────────────────────────────────────
  const handleSkip = async () => {
    setSubmitting(true);
    setSkipError("");
    try {
      const res = await fetch(`${API_URL}/providers/onboarding/skip`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("onboarding_skipped_session", "true");
        }
        router.push("/provider/dashboard");
      } else {
        const data = await res.json().catch(() => ({}));
        setSkipError(data.message || "Cannot skip. Please complete payment.");
      }
    } catch {
      setSkipError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]" />
          <p className="text-slate-500 font-medium">
            Setting up your onboarding…
          </p>
        </div>
      </div>
    );
  }

  const activeSizes = kit?.sizes?.filter((s) => s.active) || [];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* ── Header Banner ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#1D2B83] to-indigo-500 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Package size={200} />
        </div>
        <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
          <CheckCircle2 size={15} /> Verification Approved
        </div>
        <h1 className="text-3xl font-bold mb-2">Complete Your Onboarding</h1>
        <p className="text-indigo-100 max-w-xl">
          Welcome, {provider?.user_id?.name}! Purchase your mandatory Provider
          Kit to get started. You may also add category-specific accessories.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ── Left: Kit Details + Accessories ──────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Kit Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-[#1D2B83]/10 rounded-lg">
                <Package size={20} className="text-[#1D2B83]" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">
                  {kit?.name || "Provider Starter Kit"}
                </h2>
                <p className="text-sm text-slate-500">{kit?.description}</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Kit Image */}
              {kit?.images?.kit && (
                <div className="rounded-xl overflow-hidden h-48 relative">
                  <Image
                    src={kit.images.kit}
                    alt="Kit"
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              {/* Included Items */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  What&apos;s Included
                </h3>
                <div className="grid sm:grid-cols-2 gap-2">
                  {kit?.items?.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 bg-slate-50 rounded-lg p-3"
                    >
                      <CheckCircle2
                        size={16}
                        className="text-emerald-500 shrink-0"
                      />
                      <div>
                        <p className="font-medium text-slate-800 text-sm">
                          {item.name}
                        </p>
                        {item.description && (
                          <p className="text-xs text-slate-500">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Size Selector */}
              {activeSizes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Select Uniform Size
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {activeSizes.map((s) => (
                      <button
                        key={s.size}
                        onClick={() => setSelectedSize(s.size)}
                        className={`w-12 h-12 rounded-lg text-sm font-bold border-2 transition-all ${
                          selectedSize === s.size
                            ? "border-[#1D2B83] bg-[#1D2B83] text-white shadow-md"
                            : "border-slate-200 text-slate-700 hover:border-[#1D2B83]"
                        }`}
                      >
                        {s.size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Logistics Info */}
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Truck size={15} className="text-slate-400" />
                  Delivered in {kit?.estimatedDays || 5} days via{" "}
                  {kit?.shippingPartner || "Courier"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield size={15} className="text-slate-400" />
                  GST {kit?.gst}% included
                </span>
              </div>
            </div>
          </div>

          {/* ── Accessories Toggle ─────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <label className="flex items-start gap-4 cursor-pointer group">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={needsAccessories}
                  onChange={(e) => handleAccessoriesToggle(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-[#1D2B83] focus:ring-[#1D2B83] cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-800 text-base group-hover:text-[#1D2B83] transition-colors">
                  Yes, I would like to purchase additional accessories
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Browse and select professional tools and equipment specific to
                  your service category.
                </p>
              </div>
              <ShoppingBag
                size={22}
                className="text-slate-300 group-hover:text-[#1D2B83] transition-colors shrink-0"
              />
            </label>

            {/* Accessories Grid */}
            {needsAccessories && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                {accessories.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#1D2B83] mx-auto mb-3" />
                    <p>Loading accessories for your category…</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Available Accessories ({accessories.length})
                    </h3>
                    {accessories.map((acc) => (
                      <div
                        key={acc._id}
                        className="flex gap-4 p-4 rounded-xl border border-slate-200 hover:border-[#1D2B83]/40 hover:bg-slate-50 transition-all"
                      >
                        {/* Image */}
                        <div className="w-20 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 relative">
                          {acc.image ? (
                            <Image
                              src={acc.image}
                              alt={acc.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                              <ShoppingBag size={28} />
                            </div>
                          )}
                        </div>
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-800">
                                {acc.title}
                              </p>
                              <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">
                                {acc.description}
                              </p>
                            </div>
                            <p className="font-bold text-[#1D2B83] text-lg shrink-0">
                              ₹{acc.price}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-slate-400">
                              +{acc.gst_percent || 18}% GST
                            </span>
                            {cart[acc._id] ? (
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
                                <button
                                  onClick={() => updateCart(acc._id, -1)}
                                  className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="w-6 text-center font-bold text-slate-800 text-sm">
                                  {cart[acc._id]}
                                </span>
                                <button
                                  onClick={() => updateCart(acc._id, 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => updateCart(acc._id, 1)}
                                className="px-4 py-1.5 bg-[#1D2B83]/10 text-[#1D2B83] font-medium text-sm rounded-lg hover:bg-[#1D2B83] hover:text-white transition-all"
                              >
                                + Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Payment Summary ───────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6 space-y-5">
            <h2 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-4">
              Payment Summary
            </h2>

            {/* Kit Breakdown */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Provider Kit
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-700">
                  <span>{kit?.name}</span>
                  <span>₹{totals.kitBase}</span>
                </div>
                {totals.kitGst > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>GST ({kit?.gst}%)</span>
                    <span>₹{totals.kitGst}</span>
                  </div>
                )}
                {totals.delivery > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery</span>
                    <span>₹{totals.delivery}</span>
                  </div>
                )}
                {totals.convenience > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Convenience Fee</span>
                    <span>₹{totals.convenience}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Accessories Breakdown */}
            {needsAccessories && Object.keys(cart).length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Accessories
                </p>
                <div className="space-y-1.5 text-sm">
                  {Object.entries(cart).map(([id, qty]) => {
                    const acc = accessories.find((a) => a._id === id);
                    return acc ? (
                      <div
                        key={id}
                        className="flex justify-between text-slate-700"
                      >
                        <span className="truncate pr-2">
                          {acc.title}{" "}
                          <span className="text-slate-400">×{qty}</span>
                        </span>
                        <span className="shrink-0">₹{acc.price * qty}</span>
                      </div>
                    ) : null;
                  })}
                  <div className="flex justify-between text-slate-500">
                    <span>GST (18%)</span>
                    <span>₹{totals.accGst}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div className="border-t-2 border-slate-900 pt-4 flex justify-between items-center">
              <span className="font-bold text-slate-900 text-base">
                Grand Total
              </span>
              <span className="text-2xl font-bold text-[#1D2B83]">
                ₹{totals.grand}
              </span>
            </div>

            {/* Terms of Service Box */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
              <p className="text-xs font-bold text-slate-700">
                Terms of Service
              </p>
              <p className="text-xs text-slate-500 mb-1">
                By proceeding, you agree to:
              </p>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>Wear the uniform during all jobs.</li>
                <li>Maintain a minimum rating of 4.2 stars.</li>
                <li>Follow the standard pricing guidelines.</li>
                <li>Complete the mandatory training.</li>
              </ul>

              <div className="pt-2 border-t border-slate-200/60 mt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#1D2B83] focus:ring-[#1D2B83] cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-relaxed font-medium">
                    I have read and agree to the platform guidelines and terms
                    of service.
                  </span>
                </label>
              </div>
            </div>

            {/* Pay Button */}
            <button
              onClick={handlePayment}
              disabled={
                !termsAccepted ||
                submitting ||
                (activeSizes.length > 0 && !selectedSize)
              }
              className={`w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                termsAccepted &&
                !submitting &&
                (activeSizes.length === 0 || selectedSize)
                  ? "bg-[#1D2B83] text-white hover:bg-indigo-900 shadow-md hover:shadow-lg"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Proceed to Payment <ChevronRight size={18} />
                </>
              )}
            </button>

            {/* Skip */}
            <div className="pt-2 border-t border-slate-100">
              {skipError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700 mb-3">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  {skipError}
                </div>
              )}
              <button
                onClick={handleSkip}
                disabled={submitting}
                className="w-full text-sm text-slate-500 hover:text-slate-700 py-2 transition-colors underline underline-offset-2"
              >
                Skip for now →
              </button>
              <p className="text-xs text-center text-slate-400 mt-1">
                {kit?.paymentMandatory && !kit?.allowRegistrationWithoutPayment
                  ? "Skip is disabled — payment is mandatory"
                  : "You can complete payment later from your profile"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
