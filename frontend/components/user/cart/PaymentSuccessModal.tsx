"use client";

import React from "react";
import { Modal, Button } from "antd";
import { CheckCircle2, Calendar, MapPin, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingDetails: {
    id: string;
    date: string;
    slot: string;
    address: string;
  } | null;
}

const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({ 
  isOpen, 
  onClose,
  bookingDetails
}) => {

  React.useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1D2B83', '#2563EB', '#60A5FA']
      });
    }
  }, [isOpen]);

  return (
    <Modal
      title={null}
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={450}
      className="success-modal"
      closable={false}
    >
      <div className="p-4 text-center">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-in zoom-in duration-500" />
        </div>
        
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Payment Successful!</h2>
        <p className="text-slate-400 font-medium mt-1">Your service has been scheduled</p>

        <div className="mt-8 p-6 bg-slate-50 rounded-[2rem] text-left space-y-4 border border-slate-100">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scheduled For</p>
              <p className="font-bold text-slate-800">{bookingDetails?.date} • {bookingDetails?.slot}</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Location</p>
              <p className="font-bold text-slate-800 line-clamp-1">{bookingDetails?.address}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          <Button
            type="primary"
            block
            size="large"
            onClick={onClose}
            className="h-14 rounded-2xl text-base font-black bg-[#1D2B83] shadow-lg shadow-blue-900/20"
          >
            View My Bookings <ArrowRight size={18} className="ml-2 inline" />
          </Button>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            A confirmation email has been sent to you
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default PaymentSuccessModal;
