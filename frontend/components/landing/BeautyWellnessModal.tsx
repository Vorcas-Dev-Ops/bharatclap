"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Crown } from "lucide-react";
import { useRouter } from "next/navigation";

interface BeautyWellnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlug?: string[];
}

export const BeautyWellnessModal: React.FC<BeautyWellnessModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();

  const handleGenderSelect = (gender: "female" | "male") => {
    // Close modal first (state update only), then navigate
    onClose();
    // Use window.location for a hard redirect to avoid router.push race conditions
    // when multiple router.push calls fire from parent onClose handlers
    window.location.href = `/beauty/${gender}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="beauty-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-[200]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[201] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              // Stop clicks from bubbling to the backdrop behind
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-tr from-[#FCF8FF] to-white w-full max-w-lg rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden relative flex flex-col border border-slate-100/50"
            >
              {/* Header */}
              <div className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-sm">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Beauty &amp; Wellness
                </h2>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-50 rounded-full transition-all text-slate-400 hover:text-slate-600"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Gender Selection */}
              <div className="flex flex-col justify-center space-y-6 px-6 py-8">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">
                    Select Experience
                  </h3>
                  <p className="text-slate-400 text-[10px] font-semibold">
                    Salon &amp; spa services at your convenience.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Female */}
                  <motion.button
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleGenderSelect("female")}
                    className="cursor-pointer bg-white border border-pink-100 hover:border-pink-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden text-left"
                  >
                    {/* Background Image */}
                    <img
                      src="/images/women.png"
                      alt="Women Grooming"
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 pointer-events-none z-0"
                    />
                    {/* Gradient mask */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent z-10 pointer-events-none" />

                    <div className="h-10 w-10 rounded-xl bg-pink-50/90 flex items-center justify-center text-pink-500 relative z-20 shadow-sm">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 relative z-20">
                      <h4 className="text-sm font-black text-slate-800 group-hover:text-pink-600 transition-colors">
                        For Women
                      </h4>
                      <p className="text-slate-600 text-[9px] font-bold leading-tight">
                        Salon, Spa, Hair &amp; Makeup.
                      </p>
                    </div>
                  </motion.button>

                  {/* Male */}
                  <motion.button
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleGenderSelect("male")}
                    className="cursor-pointer bg-white border border-indigo-100 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between aspect-[4/3] group relative overflow-hidden text-left"
                  >
                    {/* Background Image */}
                    <img
                      src="/images/men.jpg.jpeg"
                      alt="Men Grooming"
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500 pointer-events-none z-0"
                    />
                    {/* Gradient mask */}
                    <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/50 to-transparent z-10 pointer-events-none" />

                    <div className="h-10 w-10 rounded-xl bg-indigo-50/90 flex items-center justify-center text-indigo-500 relative z-20 shadow-sm">
                      <Crown className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5 relative z-20">
                      <h4 className="text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                        For Men
                      </h4>
                      <p className="text-slate-600 text-[9px] font-bold leading-tight">
                        Salon &amp; Spa treatments.
                      </p>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
