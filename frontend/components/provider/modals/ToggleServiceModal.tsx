"use client";

import React from 'react';
import Modal from '@/components/admin/common/Modal';
import { ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';

interface ToggleServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceName: string;
  isCurrentlyActive: boolean;
  loading?: boolean;
}

export default function ToggleServiceModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  serviceName,
  isCurrentlyActive,
  loading = false 
}: ToggleServiceModalProps) {
  const isDeactivating = isCurrentlyActive;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isDeactivating ? "Deactivate Service" : "Activate Service"}
      size="sm"
    >
      <div className="p-1 space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 border-white shadow-sm ${isDeactivating ? 'bg-amber-50' : 'bg-emerald-50'}`}>
            {isDeactivating ? (
              <ToggleLeft className="w-10 h-10 text-amber-500" />
            ) : (
              <ToggleRight className="w-10 h-10 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Are you sure?</h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
            You are about to <span className="font-bold text-slate-700">{isDeactivating ? 'deactivate' : 'activate'}</span> <span className="text-slate-900 font-bold">"{serviceName}"</span>.
          </p>
        </div>

        {/* Info Badge */}
        <div className={`border rounded-2xl p-4 flex items-start gap-3 ${isDeactivating ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isDeactivating ? 'text-amber-500' : 'text-emerald-500'}`} />
          <p className={`text-[11px] font-bold leading-tight ${isDeactivating ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isDeactivating 
              ? "Customers will temporarily not be able to book this service. You can reactivate it at any time."
              : "This service will become immediately available for customers to book."
            }
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3.5 bg-slate-100 text-slate-600 font-bold text-sm rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-6 py-3.5 text-white font-bold text-sm rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${
              isDeactivating 
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
            }`}
          >
            {loading ? "Saving..." : (isDeactivating ? "Yes, Deactivate" : "Yes, Activate")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
