"use client";

import React, { useState } from "react";
import { Modal, Radio, Button, Input, Space, Divider } from "antd";
import { CreditCard, Smartphone, ShieldCheck, CheckCircle2 } from "lucide-react";

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
  amount 
}) => {
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    // Simulate payment gateway delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    onSuccess();
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
    >
      <div className="p-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Secure Payment</h2>
          <p className="text-slate-400 font-medium mt-1">Complete your transaction for ₹{amount}</p>
        </div>

        <div className="space-y-4">
          <div 
            onClick={() => setMethod("upi")}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              method === "upi" ? "border-blue-600 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-xl ${method === "upi" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                <Smartphone size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">UPI / GPay / PhonePe</p>
                <p className="text-xs text-slate-400">Pay using any UPI app</p>
              </div>
              <Radio checked={method === "upi"} />
            </div>
            {method === "upi" && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                <Input placeholder="Enter UPI ID (e.g. user@okaxis)" className="rounded-xl h-12 font-medium" />
              </div>
            )}
          </div>

          <div 
            onClick={() => setMethod("card")}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              method === "card" ? "border-blue-600 bg-blue-50/50" : "border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-2 rounded-xl ${method === "card" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                <CreditCard size={20} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">Credit / Debit Card</p>
                <p className="text-xs text-slate-400">All major cards supported</p>
              </div>
              <Radio checked={method === "card"} />
            </div>
            {method === "card" && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                <Input placeholder="Card Number" className="rounded-xl h-12 font-medium" />
                <div className="flex gap-3">
                  <Input placeholder="MM/YY" className="rounded-xl h-12 font-medium" />
                  <Input placeholder="CVV" className="rounded-xl h-12 font-medium" />
                </div>
              </div>
            )}
          </div>
        </div>

        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={handlePayment}
          className="h-14 rounded-2xl mt-8 text-base font-black shadow-lg shadow-blue-600/20 bg-blue-600"
        >
          {loading ? "Processing Payment..." : `Pay ₹${amount}`}
        </Button>

        <div className="flex items-center justify-center gap-2 mt-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          <CheckCircle2 size={12} className="text-emerald-500" />
          PCI-DSS Certified Secure Checkout
        </div>
      </div>
    </Modal>
  );
};

export default PaymentGatewayModal;
