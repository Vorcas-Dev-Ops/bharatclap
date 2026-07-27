"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { refundService, AuditLogEntry } from '@/services/refund.service';
import EmptyState from '@/components/common/EmptyState';

export default function AdminRefundAuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        setLoading(true);
        const data = await refundService.getAuditLogs();
        setAuditLogs(data);
      } finally {
        setLoading(false);
      }
    }
    loadAuditLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Immutable Audit Trail</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Complete security audit history of every refund, approval, and ledger entry</p>
        </div>
        <Link href="/admin/refunds" className="text-xs font-bold text-indigo-600 hover:underline">
          ← Back to Overview
        </Link>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 font-semibold animate-pulse">Loading security audit logs...</div>
      ) : auditLogs.length === 0 ? (
        <EmptyState
          title="No Audit Logs"
          description="Security audit history will appear here as refund operations occur."
          actionText="Back to Overview"
          onAction={() => window.location.href = '/admin/refunds'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3 font-mono text-xs">
          {auditLogs.map((log, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-bold">{log.timestamp}</span> — <span className="font-bold text-indigo-600">{log.user}</span>: <span className="text-slate-800">{log.action}</span>
              </div>
              <span className="text-slate-400 text-[10px]">{log.ip}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
