"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface CelebrationModalProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  type?: "booking" | "payment" | "success";
}

const CelebrationModal: React.FC<CelebrationModalProps> = ({
  open,
  title = "Booking Confirmed!",
  subtitle = "Your service has been booked successfully",
  onClose,
  type = "booking"
}) => {
  useEffect(() => {
    if (open) {
      // Trigger confetti
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Auto close after 4 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="w-full max-w-md bg-white rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
          >
            {/* Background Decorative Gradient */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600" />
            
            {/* Success Icon/Animation Placeholder */}
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mb-8 relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white"
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <motion.path 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="3" 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </motion.div>
              
              {/* Pulsing rings */}
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-4 border-emerald-500/30" 
              />
            </div>

            <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
              {title}
            </h2>

            <p className="text-slate-500 font-medium text-lg leading-relaxed mb-10">
              {subtitle}
            </p>

            <button
              onClick={onClose}
              className="w-full py-4 bg-[#1D2B83] text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Continue
            </button>
            
            <p className="mt-6 text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
              Closing automatically in 3s
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CelebrationModal;
