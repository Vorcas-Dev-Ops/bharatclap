"use client";

import React, { useState } from "react";
import { Modal, Spin } from "antd";
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { API_URL } from "@/config/api";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  amount: number;
}

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
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
        body: JSON.stringify({ amount }),
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
        description: "Service Booking Payment",
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
                amount,
              }),
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.message || "Payment verification failed");
            }

            // Payment verified — proceed with booking
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

      // Check if Razorpay script is loaded
      if (typeof window.Razorpay === "undefined") {
        throw new Error("Payment gateway is loading. Please try again in a moment.");
      }

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response: any) {
        console.error("Payment failed:", response.error);
        setError(
          response.error?.description ||
            "Payment failed. Please try again."
        );
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <Modal
      title={null}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={450}
      className="payment-modal"
      maskClosable={!loading}
      closable={!loading}
    >
      <div className="p-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">
            Secure Payment
          </h2>
          <p className="text-slate-400 font-medium mt-1">
            Complete your transaction for ₹{amount}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-700">Payment Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-600">Amount</span>
              <span className="text-xl font-black text-[#1D2B83]">₹{amount}</span>
            </div>
            <div className="text-xs text-slate-400 font-medium">
              You will be redirected to Razorpay&apos;s secure payment page where you can pay using UPI, Cards, Net Banking, or Wallets.
            </div>
          </div>
        </div>

        <button
          onClick={handlePayment}
          disabled={loading}
          className="w-full h-14 rounded-2xl mt-8 text-base font-black shadow-lg shadow-blue-600/20 bg-[#1D2B83] text-white flex items-center justify-center gap-2 hover:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Spin size="small" className="[&_.ant-spin-dot-item]:bg-white" />
              <span>Processing...</span>
            </>
          ) : (
            `Pay ₹${amount}`
          )}
        </button>

        <div className="flex items-center justify-center gap-2 mt-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          <CheckCircle2 size={12} className="text-emerald-500" />
          Secured by Razorpay • PCI-DSS Certified
        </div>
      </div>
    </Modal>
  );
};

export default PaymentGatewayModal;
