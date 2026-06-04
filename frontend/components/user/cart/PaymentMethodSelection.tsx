"use client";

import React from "react";
import { CreditCard, Wallet, CheckCircle2 } from "lucide-react";

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => setPaymentMethod("online")}
          className={`flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all text-left ${
            paymentMethod === "online" 
              ? "bg-white border-[#1D2B83] shadow-xl" 
              : "bg-white border-slate-100 opacity-60 hover:opacity-100"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paymentMethod === "online" ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-400"}`}>
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">Online Payment</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">UPI, Cards, Netbanking</p>
          </div>
          {paymentMethod === "online" && <CheckCircle2 className="w-5 h-5 text-[#1D2B83] ml-auto" />}
        </button>

        <button
          onClick={() => setPaymentMethod("cod")}
          className={`flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all text-left ${
            paymentMethod === "cod" 
              ? "bg-white border-[#1D2B83] shadow-xl" 
              : "bg-white border-slate-100 opacity-60 hover:opacity-100"
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${paymentMethod === "cod" ? "bg-[#1D2B83] text-white" : "bg-slate-100 text-slate-400"}`}>
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">Pay after Service</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Cash, UPI after job</p>
          </div>
          {paymentMethod === "cod" && <CheckCircle2 className="w-5 h-5 text-[#1D2B83] ml-auto" />}
        </button>
      </div>
    </section>
  );
}
