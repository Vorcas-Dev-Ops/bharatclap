"use client";

import React from 'react';
import { FileCheck, Upload, AlertCircle, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

export default function ProviderDocumentsPage() {
  const documents = [
    { title: 'Identity Proof (Aadhaar Card)', status: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { title: 'PAN Card Verification', status: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { title: 'Bank Account Details & Cancelled Cheque', status: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { title: 'GST Registration Certificate', status: 'Optional / Verified', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { title: 'Work Insurance Certificate', status: 'Expiring Soon (30 days)', color: 'bg-amber-50 text-amber-700 border-amber-200' }
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Documents & Verification Status</h1>
          <p className="text-xs text-gray-500 font-medium">PAN, Aadhaar, GST, Bank Details, Insurance, and Expiry Reminders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {documents.map((doc, idx) => (
          <div key={idx} className="p-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-gray-900">{doc.title}</h3>
              <span className={`inline-block px-2 py-0.5 text-[9px] font-bold rounded-md border ${doc.color}`}>
                {doc.status}
              </span>
            </div>

            <button className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5">
              <Upload size={12} />
              Re-upload
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
