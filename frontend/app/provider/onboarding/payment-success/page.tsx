"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Trigger confetti
    const end = Date.now() + 3 * 1000;
    const colors = ["#1D2B83", "#10b981"];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors,
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Countdown to redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/provider/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center animate-bounce">
            <CheckCircle2 size={48} className="text-emerald-500" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-4">
          Payment Successful!
        </h1>
        <p className="text-slate-600 mb-8 text-lg">
          Your order has been placed. You have successfully completed the
          onboarding process!
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
          <p className="text-sm text-slate-500 mb-1">
            Redirecting to your dashboard in
          </p>
          <div className="text-3xl font-bold text-[#1D2B83]">{countdown}</div>
        </div>

        <button
          onClick={() => router.push("/provider/dashboard")}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#1D2B83] text-white rounded-xl font-medium hover:bg-blue-900 transition-colors"
        >
          Go to Dashboard Now <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
