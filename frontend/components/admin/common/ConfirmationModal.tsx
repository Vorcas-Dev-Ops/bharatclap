"use client";

import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, CheckCircle2, Info } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger'
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const variantStyles = {
    danger: {
      accent: 'bg-red-600',
      glow: 'bg-red-500/10',
      shadow: 'shadow-red-200',
      icon: AlertTriangle,
      btn: 'bg-red-600 hover:bg-red-700 shadow-red-200'
    },
    warning: {
      accent: 'bg-amber-500',
      glow: 'bg-amber-500/10',
      shadow: 'shadow-amber-200',
      icon: AlertTriangle,
      btn: 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
    },
    success: {
      accent: 'bg-emerald-600',
      glow: 'bg-emerald-500/10',
      shadow: 'shadow-emerald-200',
      icon: CheckCircle2,
      btn: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
    },
    info: {
      accent: 'bg-blue-600',
      glow: 'bg-blue-500/10',
      shadow: 'shadow-blue-200',
      icon: Info,
      btn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
    }
  };

  const style = variantStyles[variant];
  const Icon = style.icon;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-[380px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden border border-gray-100/50 pointer-events-auto flex flex-col items-center p-8 pt-10 text-center"
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>

          {/* Icon Section */}
          <div className="relative mb-6">
            <div className={`absolute inset-0 ${style.glow} blur-xl rounded-full scale-150 animate-pulse`} />
            <div className={`relative w-12 h-12 ${style.accent} rounded-xl rotate-45 flex items-center justify-center shadow-lg ${style.shadow}`}>
              <div className="-rotate-45">
                <Icon size={24} className="text-white fill-white/20" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-3 mb-10">
            <h3 className="text-xl font-bold text-gray-900 leading-tight tracking-tight uppercase">
              {title}
            </h3>
            <p className="text-[13px] font-medium text-gray-500 leading-relaxed max-w-[280px]">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 order-2 sm:order-1 py-3.5 ${style.btn} text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all`}
            >
              {confirmLabel}
            </button>
            <button
              onClick={onClose}
              className="flex-1 order-1 sm:order-2 py-3.5 bg-white border-2 border-gray-100 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 active:scale-95 transition-all"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmationModal;
