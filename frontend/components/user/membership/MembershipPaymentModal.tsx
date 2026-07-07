"use client";

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Spin } from 'antd';
import { API_URL } from '@/config/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: any;
}

const MembershipPaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, plan }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setLoading(false);
      setError(null);
    }
  }, [isOpen]);

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setError("Please login to continue");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Create Razorpay order on our backend
      const orderRes = await fetch(`${API_URL}/payments/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: plan?.price }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.message || "Failed to create payment order");
      }

      const orderData = await orderRes.json();

      // Step 2: Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "BharatClap",
        description: `${plan?.name} Membership`,
        order_id: orderData.razorpay_order_id,
        handler: async function (response: any) {
          // Step 3: Verify payment on backend
          try {
            const verifyRes = await fetch(`${API_URL}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: plan?.price,
              }),
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.message || "Payment verification failed");
            }

            setLoading(false);
            onSuccess();
          } catch (verifyErr: any) {
            console.error("Payment verification failed:", verifyErr);
            setError(verifyErr.message || "Payment verification failed. Please contact support.");
            setLoading(false);
          }
        },
        prefill: {},
        theme: {
          color: "#1D2B83",
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
          escape: true,
          confirm_close: true,
        },
      };

      if (typeof window.Razorpay === "undefined") {
        throw new Error("Payment gateway is loading. Please try again in a moment.");
      }

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response: any) {
        console.error("Payment failed:", response.error);
        setError(response.error?.description || "Payment failed. Please try again.");
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={!loading ? onClose : undefined}
      />

      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-[440px] bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] overflow-hidden"
      >
        {/* Header */}
        <div className="px-8 py-6 flex justify-between items-center border-b border-slate-50 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Checkout
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Secure Razorpay Payment
              </p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <X size={20} className="text-slate-400" />
            </button>
          )}
        </div>

        <div className="p-8 space-y-6">
          {/* Plan Summary */}
          <div className="p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Selected Plan</p>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{plan?.name} Membership</h3>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-blue-600">₹{plan?.price}</p>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">Payment Error</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Payment Info */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              You will be redirected to Razorpay&apos;s secure payment page where you can pay using UPI, Cards, Net Banking, or Wallets.
            </p>
          </div>

          {/* Pay Button */}
          <button
            disabled={loading}
            onClick={handlePay}
            className="w-full h-14 bg-[#1D2B83] text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all flex items-center justify-center gap-2 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Spin size="small" className="[&_.ant-spin-dot-item]:bg-white" />
                <span>Processing...</span>
              </>
            ) : (
              <>Pay ₹{plan?.price} Securely</>
            )}
          </button>

          <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
            <ShieldCheck size={12} className="text-emerald-500" />
            Secured by Razorpay • PCI-DSS Certified
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default MembershipPaymentModal;
