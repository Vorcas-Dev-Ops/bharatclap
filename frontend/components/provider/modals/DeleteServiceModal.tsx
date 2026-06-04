"use client";

import React from 'react';
import Modal from '@/components/admin/common/Modal';
import { Trash2, AlertTriangle, X } from 'lucide-react';

interface DeleteServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceName: string;
  loading?: boolean;
}

export default function DeleteServiceModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  serviceName,
  loading = false 
}: DeleteServiceModalProps) {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Delete Service"
      size="sm"
    >
      <div className="p-1 space-y-6">
        {/* Warning Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center border-4 border-white shadow-sm">
            <Trash2 className="w-10 h-10 text-rose-500" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Are you absolutely sure?</h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed px-4">
            You are about to remove <span className="text-slate-900 font-bold">"{serviceName}"</span> from your profile. This action cannot be undone.
          </p>
        </div>

        {/* Warning Badge */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-amber-700 leading-tight">
            Deleting this service will also remove all associated sub-service mappings and pricing data.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3.5 bg-slate-100 text-slate-600 font-bold text-sm rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            No, Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-6 py-3.5 bg-rose-500 text-white font-bold text-sm rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? "Deleting..." : <><Trash2 className="w-4 h-4" /> Yes, Delete</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}
