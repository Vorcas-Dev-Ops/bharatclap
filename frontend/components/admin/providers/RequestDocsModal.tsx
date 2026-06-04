"use client";

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileSearch, X } from 'lucide-react';
import Button from '../common/Button';
import { Provider } from '../types';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface RequestDocsModalProps {
  isOpen: boolean;
  provider: Provider | null;
  onClose: () => void;
  onRequested: () => void;
}

const DOC_OPTIONS = [
  'Government ID proof',
  'Address proof',
  'Professional certification',
  'Experience certificate',
  'Business registration',
  'GST certificate',
  'PAN card',
  'Police verification',
  'Portfolio / Work images',
  'Bank account proof',
];

const RequestDocsModal: React.FC<RequestDocsModalProps> = ({
  isOpen,
  provider,
  onClose,
  onRequested,
}) => {
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !provider) return null;

  const toggleDoc = (doc: string) => {
    setSelectedDocs(prev =>
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    );
  };

  const handleRequest = async () => {
    if (selectedDocs.length === 0 && !additionalNotes.trim()) return;
    setIsSending(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/providers/${provider._id}/verification-action`,
        {
          action_type: 'requested_docs',
          requested_docs: selectedDocs,
          custom_message: additionalNotes,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onRequested();
      onClose();
      setSelectedDocs([]);
      setAdditionalNotes('');
    } catch (err) {
      console.error('Request docs failed:', err);
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-[2rem] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <FileSearch size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Request Documents</h3>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                {provider.user_id?.name || 'Provider'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-amber-100 rounded-xl transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-3">
              Select Required Documents
            </p>
            <div className="flex flex-wrap gap-2">
              {DOC_OPTIONS.map(doc => (
                <button
                  key={doc}
                  onClick={() => toggleDoc(doc)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${
                    selectedDocs.includes(doc)
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-amber-200 hover:text-amber-600'
                  }`}
                >
                  {doc}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">
              Additional Instructions (Optional)
            </p>
            <textarea
              value={additionalNotes}
              onChange={e => setAdditionalNotes(e.target.value)}
              placeholder="Provide specific instructions to the provider..."
              rows={3}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 resize-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <Button variant="outline" size="sm" onClick={onClose} className="text-[10px] font-black uppercase">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleRequest}
            disabled={isSending || (selectedDocs.length === 0 && !additionalNotes.trim())}
            className="text-[10px] font-black uppercase bg-amber-500 hover:bg-amber-600 border-amber-500 shadow-lg"
          >
            {isSending ? 'Sending Mail...' : 'Send Request'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequestDocsModal;
