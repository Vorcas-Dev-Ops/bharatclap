"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  Smartphone, 
  Building2, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowLeft,
  ChevronRight,
  Lock,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: any;
}

const MembershipPaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, plan }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking' | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset state when modal closes/opens
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setMethod(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handlePay = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 2000);
  };

  const selectMethod = (m: 'upi' | 'card' | 'netbanking') => {
    setMethod(m);
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
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
            {step === 2 && (
              <button 
                onClick={() => setStep(1)} 
                className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-slate-900"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {step === 1 ? 'Checkout' : 'Payment Details'}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                {step === 1 ? 'Select Payment Method' : `Secure ${method?.toUpperCase()} Payment`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto max-h-[85vh] no-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
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

                <div className="space-y-3">
                  <PaymentOption 
                    id="upi" icon={<Smartphone size={18} />} label="UPI" 
                    sublabel="Google Pay, PhonePe, Paytm"
                    onClick={() => selectMethod('upi')}
                  />
                  <PaymentOption 
                    id="card" icon={<CreditCard size={18} />} label="Debit / Credit Card" 
                    sublabel="Visa, Mastercard, RuPay"
                    onClick={() => selectMethod('card')}
                  />
                  <PaymentOption 
                    id="netbanking" icon={<Building2 size={18} />} label="Net Banking" 
                    sublabel="All major Indian banks"
                    onClick={() => selectMethod('netbanking')}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {method === 'upi' && (
                  <div className="space-y-4">
                    <div className="p-6 rounded-[2rem] bg-gradient-to-br from-purple-600 to-indigo-700 text-white relative overflow-hidden shadow-xl shadow-indigo-200">
                      <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                      <div className="relative z-10 space-y-6">
                        <div className="flex justify-between items-center">
                          <Smartphone size={28} className="opacity-80" />
                          <div className="text-[10px] font-black tracking-[0.2em] bg-white/20 px-3 py-1.5 rounded-xl backdrop-blur-sm">UPI SECURE</div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">Enter VPA / UPI ID</label>
                          <input 
                            type="text" placeholder="username@upi" autoFocus
                            className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-4 text-sm font-bold placeholder:text-white/30 outline-none focus:bg-white/20 focus:border-white/40 transition-all shadow-inner"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm">
                        <Smartphone size={14} />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-tight">
                        We'll send a payment request to your UPI app. Open it to approve.
                      </p>
                    </div>
                  </div>
                )}

                {method === 'card' && (
                  <div className="space-y-6">
                    {/* ATM Card Design */}
                    <div className="relative aspect-[1.58/1] w-full rounded-[1.8rem] bg-slate-900 p-8 text-white overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none" 
                           style={{ backgroundImage: 'radial-gradient(circle at 10% 150%, #4f46e5 0%, transparent 60%), radial-gradient(circle at 90% -40%, #818cf8 0%, transparent 60%)' }} />
                      
                      <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-8 bg-gradient-to-br from-amber-400 to-amber-200 rounded-lg shadow-lg flex items-center justify-center overflow-hidden">
                             <div className="w-full h-0.5 bg-black/10 my-0.5" />
                             <div className="w-full h-0.5 bg-black/10 my-0.5" />
                          </div>
                          <Globe size={24} className="opacity-30" />
                        </div>
                        
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black tracking-[0.3em] opacity-40 uppercase">Card Number</p>
                          <input 
                            type="text" placeholder="XXXX XXXX XXXX XXXX" maxLength={19} autoFocus
                            className="w-full bg-transparent border-none text-xl font-black tracking-[0.15em] placeholder:text-white/10 outline-none"
                          />
                        </div>

                        <div className="flex gap-12">
                          <div className="space-y-1">
                            <p className="text-[7px] font-black tracking-[0.2em] opacity-40 uppercase">Valid Thru</p>
                            <input type="text" placeholder="MM/YY" className="w-16 bg-transparent border-none text-sm font-black outline-none placeholder:text-white/10" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[7px] font-black tracking-[0.2em] opacity-40 uppercase">CVV</p>
                            <input type="password" placeholder="***" className="w-12 bg-transparent border-none text-sm font-black outline-none placeholder:text-white/10" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Billing Amount</p>
                          <p className="text-sm font-black text-slate-900">₹{plan?.price}</p>
                       </div>
                       <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-emerald-500" />
                          <p className="text-[9px] font-black text-slate-600 uppercase tracking-tight">PCI Compliant</p>
                       </div>
                    </div>
                  </div>
                )}

                {method === 'netbanking' && (
                  <div className="space-y-6">
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                       <div className="w-16 h-16 rounded-[1.5rem] bg-white flex items-center justify-center text-blue-600 shadow-xl shadow-blue-500/10 mx-auto">
                          <Building2 size={32} />
                       </div>
                       <div className="text-center space-y-1">
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">Net Banking Selection</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Select your trusted bank</p>
                       </div>
                       <div className="space-y-2">
                          <select className="w-full h-14 px-5 rounded-2xl bg-white border border-slate-200 text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none shadow-sm cursor-pointer">
                            <option>State Bank of India</option>
                            <option>HDFC Bank</option>
                            <option>ICICI Bank</option>
                            <option>Axis Bank</option>
                            <option>Kotak Mahindra Bank</option>
                          </select>
                          <p className="text-[9px] text-slate-400 font-bold text-center italic">
                            Redirection to secure bank portal after confirmation.
                          </p>
                       </div>
                    </div>
                  </div>
                )}

                {/* Footer Pay Button */}
                <div className="pt-4 space-y-4">
                  <button
                    disabled={loading}
                    onClick={handlePay}
                    className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Lock size={14} />
                        Pay ₹{plan?.price} Securely
                      </>
                    )}
                  </button>
                  <p className="text-[9px] text-slate-400 text-center font-bold uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Guaranteed Safe Checkout
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Safety Info - Only on Step 1 */}
        {step === 1 && (
          <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <Lock size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">SSL Secure</span>
            </div>
            <div className="flex items-center gap-1.5 grayscale opacity-50">
              <ShieldCheck size={12} />
              <span className="text-[8px] font-black uppercase tracking-widest">PCI DSS</span>
            </div>
          </div>
        )}
      </motion.div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

const PaymentOption = ({ id, icon, label, sublabel, onClick }: any) => (
  <button
    onClick={onClick}
    className="w-full p-5 rounded-2xl border border-slate-100 bg-white hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-left flex items-center gap-4 group"
  >
    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-blue-600 group-hover:text-white shadow-inner">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-xs font-black uppercase tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">{label}</p>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{sublabel}</p>
    </div>
    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center transition-all group-hover:bg-blue-50 text-slate-300 group-hover:text-blue-600">
      <ChevronRight size={16} />
    </div>
  </button>
);

export default MembershipPaymentModal;
