"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, X } from 'lucide-react';
import Button from '../common/Button';
import { Provider } from '../types';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface RejectVerificationModalProps {
  isOpen: boolean;
  provider: Provider | null;
  onClose: () => void;
  onRejected: () => void;
}

const REJECTION_REASONS = [
  'Invalid identity proof',
  'Blurred / unreadable document',
  'Business details mismatch',
  'Phone number verification failed',
  'Experience proof missing',
  'Incomplete profile information',
  'Service expertise not verified',
  'Duplicate account detected',
  'Address verification failed',
  'Suspicious activity detected',
];

const RejectVerificationModal: React.FC<RejectVerificationModalProps> = ({
  isOpen,
  provider,
  onClose,
  onRejected,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !provider) return null;

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const handleReject = async () => {
    if (selectedReasons.length === 0 && !additionalNotes.trim()) return;
    setIsSending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/providers/${provider._id}/verification-action`,
        {
          action_type: 'rejected',
          reasons: selectedReasons,
          custom_message: additionalNotes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onRejected();
      onClose();
      setSelectedReasons([]);
      setAdditionalNotes('');
    } catch (err) {
      console.error('Rejection failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-[2rem] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <ShieldAlert size={18} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Reject Application</h3>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                {provider.user_id?.name || 'Provider'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-100 rounded-xl transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-3">
              Select Rejection Reasons
            </p>
            <div className="flex flex-wrap gap-2">
              {REJECTION_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => toggleReason(reason)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${
                    selectedReasons.includes(reason)
                      ? 'bg-red-600 text-white border-red-600 shadow-md'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-red-200 hover:text-red-500'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">
              Additional Notes (Optional)
            </p>
            <textarea
              value={additionalNotes}
              onChange={e => setAdditionalNotes(e.target.value)}
              placeholder="Add specific details about the rejection..."
              rows={3}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-200 resize-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose} className="text-[10px] font-black uppercase">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleReject}
            disabled={isSending || (selectedReasons.length === 0 && !additionalNotes.trim())}
            className="text-[10px] font-black uppercase bg-red-600 shadow-lg"
          >
            {isSending ? 'Sending Mail...' : 'Send Rejection Mail'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RejectVerificationModal;
