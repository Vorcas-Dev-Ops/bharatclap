"use client";

import React from "react";
import { CreditCard, QrCode, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";

interface PaymentMethodSelectionProps {
  paymentMethod: "online" | "cod";
  setPaymentMethod: (method: "online" | "cod") => void;
}

export default function PaymentMethodSelection({
  paymentMethod,
  setPaymentMethod
}: PaymentMethodSelectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
        <CreditCard className="w-3.5 h-3.5" /> Payment Method
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Option 1: Pay Online */}
        <button
          type="button"
          onClick={() => setPaymentMethod("online")}
          className={`flex items-start gap-4 p-5 rounded-[1.75rem] border-2 transition-all text-left ${
            paymentMethod === "online" 
              ? "bg-white border-[#1D2B83] shadow-xl shadow-blue-900/5" 
              : "bg-white border-slate-100 opacity-70 hover:opacity-100"
          }`}
        >
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${paymentMethod === "online" ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-400"}`}>
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800">Pay Online</h4>
              {paymentMethod === "online" && <CheckCircle2 className="w-5 h-5 text-[#1D2B83]" />}
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
              Pay securely through UPI, Card or other available methods
            </p>
          </div>
        </button>

        {/* Option 2: Pay Provider */}
        <button
          type="button"
          onClick={() => setPaymentMethod("cod")}
          className={`flex items-start gap-4 p-5 rounded-[1.75rem] border-2 transition-all text-left ${
            paymentMethod === "cod" 
              ? "bg-white border-[#1D2B83] shadow-xl shadow-blue-900/5" 
              : "bg-white border-slate-100 opacity-70 hover:opacity-100"
          }`}
        >
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${paymentMethod === "cod" ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-400"}`}>
            <QrCode className="w-5.5 h-5.5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-800">Pay Provider</h4>
              {paymentMethod === "cod" && <CheckCircle2 className="w-5 h-5 text-[#1D2B83]" />}
            </div>
            <p className="text-[11px] font-medium text-slate-500 mt-1 leading-snug">
              Pay the service provider directly after the service
            </p>
          </div>
        </button>
      </div>

      {/* Pay Provider Detailed Guidance Card */}
      {paymentMethod === "cod" && (
        <div className="p-5 bg-blue-50/70 border border-blue-100 rounded-[1.75rem] text-slate-700 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#1D2B83]" />
            <h5 className="text-xs font-black uppercase tracking-wider text-[#1D2B83]">Pay Provider</h5>
          </div>
          <p className="text-xs font-medium leading-relaxed text-slate-600">
            You will pay the provider directly after your service is completed.
          </p>
          <div className="pt-2 border-t border-blue-100/80 space-y-1">
            <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D2B83]" />
              Preferred payment: <span className="text-[#1D2B83]">UPI via provider QR</span>
            </p>
            <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 pl-3">
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
              Cash is available only if UPI payment is unavailable.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
