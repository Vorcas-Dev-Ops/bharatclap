"use client";

import React, { useState } from "react";
import { Modal, Spin } from "antd";
import { ShieldCheck, CheckCircle2, AlertCircle, QrCode, CreditCard, Building2, Wallet, XCircle, RefreshCw, ShoppingCart, Home } from "lucide-react";
import { API_URL } from "@/config/api";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentData?: any) => void;
  amount: number;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  amount,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFailedState, setIsFailedState] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<"upi" | "card" | "netbanking" | "wallet">("upi");

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    setIsFailedState(false);

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setError("Please login to continue");
      setLoading(false);
      return;
    }

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const attemptId = `ATT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const correlationId = `CORR_${Date.now()}`;

      // Step 1: Create Razorpay order on backend
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
                payment_channel: selectedChannel,
                payment_attempt_id: attemptId,
                correlation_id: correlationId,
                gateway_response: response,
              }),
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.message || "Payment verification failed");
            }

            const verifyData = await verifyRes.json();

            // Payment verified — proceed with booking
            setLoading(false);
            onSuccess(verifyData.payment);
          } catch (verifyErr: any) {
            setError(verifyErr.message || "Payment verification failed. Please contact support.");
            setIsFailedState(true);
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

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response: any) {
        setError(
          response?.error?.description ||
            "Payment failed or was cancelled. Please try again."
        );
        setIsFailedState(true);
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setIsFailedState(true);
      setLoading(false);
    }
  React.useEffect(() => {
    if (isOpen && !isFailedState && !loading) {
      handlePayment();
    }
  }, [isOpen]);

  const handleCloseModal = () => {
    setIsFailedState(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      title={null}
      open={isOpen}
      onCancel={handleCloseModal}
      footer={null}
      centered
      width={420}
      className="payment-modal"
      closable={!loading}
      keyboard={!loading}
      mask={{ closable: !loading }}
    >
      <div className="p-6">
        {isFailedState ? (
          /* Dedicated Payment Failed Screen */
          <div className="text-center py-2 space-y-5">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 shadow-sm">
              <XCircle className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Payment Failed</h2>
              <p className="text-slate-500 text-xs mt-1.5 max-w-xs mx-auto font-medium">
                {error || "We couldn't process your payment. Don't worry, no money was deducted."}
              </p>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                onClick={handlePayment}
                className="w-full h-12 bg-[#1D2B83] text-white font-bold text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-800 shadow-md shadow-blue-900/10 transition-all"
              >
                <RefreshCw size={15} />
                Try Payment Again
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleCloseModal}
                  className="h-11 bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all"
                >
                  <ShoppingCart size={14} />
                  Return to Cart
                </button>

                <button
                  onClick={() => {
                    handleCloseModal();
                    router.push("/");
                  }}
                  className="h-11 bg-slate-100 text-slate-700 font-bold text-[11px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all"
                >
                  <Home size={14} />
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Sleek Direct Redirect Loading State */
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#1D2B83]">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">
                Opening Payment Gateway
              </h2>
              <p className="text-slate-400 text-xs font-medium mt-1">
                Transaction total: <span className="font-black text-slate-800">₹{amount}</span>
              </p>
            </div>

            <div className="py-4 flex flex-col items-center justify-center gap-3">
              <Spin size="large" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                Redirecting to Razorpay...
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest pt-2">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Secured by Razorpay • 256-Bit Encrypted
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PaymentGatewayModal;

