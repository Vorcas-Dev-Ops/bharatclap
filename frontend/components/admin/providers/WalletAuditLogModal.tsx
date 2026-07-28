"use client";

import React, { useState, useEffect } from 'react';
import { X, FileText, Search, Shield, RefreshCcw } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import Table from '../common/Table';

interface WalletAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId?: string | null;
}

const WalletAuditLogModal: React.FC<WalletAuditLogModalProps> = ({
  isOpen,
  onClose,
  providerId
}) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = {};
      if (providerId) params.providerId = providerId;
      if (search) params.search = search;
      if (sourceFilter && sourceFilter !== 'all') params.source = sourceFilter;

      const res = await axios.get(`${API_URL}/providers/admin/wallet-audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load wallet audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, providerId, search, sourceFilter]);

  if (!isOpen) return null;

  const headers = ['Ref ID', 'Date & Time', 'Source', 'Initiator', 'Provider', 'Action', 'Amount', 'Prev Balance', 'New Balance', 'Reason & Remarks', 'Status'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
              <FileText size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Immutable Wallet Audit Logs</span>
                <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-[9px] uppercase tracking-wider font-bold">
                  Immutable Record
                </span>
              </h2>
              <p className="text-xs text-gray-300 font-medium">Permanent non-editable audit trail for system events, recharges, lead fees, refunds, and admin adjustments.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Source Filter Tabs */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by Ref ID, Admin Name, Provider, Reason..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto bg-gray-200/60 p-1 rounded-xl">
            {['all', 'System', 'Admin', 'Razorpay', 'Booking', 'Refund'].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                  sourceFilter === src
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {src === 'all' ? 'All Sources' : src}
              </button>
            ))}
          </div>

          <button
            onClick={fetchLogs}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-100 transition-all flex items-center gap-1.5"
          >
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {/* Content Table */}
        <div className="p-6 overflow-y-auto flex-1">
          <Table headers={headers} compact>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-gray-400 font-medium">Loading audit logs...</td>
              </tr>
            ) : logs.length > 0 ? (
              logs.map((log: any) => {
                const src = log.source || (log.adminName && log.adminName !== 'System' ? 'Admin' : 'System');
                const isCredit = ['Wallet Credit', 'Initial Credit', 'Recharge', 'Refund', 'Release', 'Credit'].includes(log.action);
                return (
                  <tr key={log._id || log.transactionRefId} className="hover:bg-amber-50/20 text-[10px] border-b border-gray-50">
                    <td className="px-2 py-3 font-black text-gray-900 tracking-wider font-mono">
                      {log.transactionRefId}
                    </td>
                    <td className="px-2 py-3 font-bold text-gray-600">
                      {new Date(log.date || log.createdAt).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-2 py-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-black ${
                        src === 'System' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        src === 'Razorpay' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        src === 'Booking' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        src === 'Refund' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {src}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-bold text-gray-800">
                      {log.adminName || 'System'} {log.adminRole ? `(${log.adminRole})` : ''}
                    </td>
                    <td className="px-2 py-3 font-bold text-gray-900">
                      {log.providerName}
                    </td>
                    <td className="px-2 py-3 font-black">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider ${
                        isCredit ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className={`px-2 py-3 font-black ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                      {isCredit ? '+' : '-'}₹{log.amount?.toLocaleString('en-IN') || 0}
                    </td>
                    <td className="px-2 py-3 font-bold text-gray-500">
                      ₹{log.previousBalance?.toLocaleString('en-IN') || 0}
                    </td>
                    <td className="px-2 py-3 font-black text-gray-900">
                      ₹{log.newBalance?.toLocaleString('en-IN') || 0}
                    </td>
                    <td className="px-2 py-3 max-w-xs">
                      <div className="font-bold text-gray-900">{log.reason}</div>
                      {log.remarks && log.remarks !== log.reason && (
                        <div className="text-gray-500 font-medium text-[9px] line-clamp-1">{log.remarks}</div>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                        log.approvalStatus === 'pending_approval' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        log.status === 'Manual Freeze' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {log.approvalStatus === 'pending_approval' ? 'Pending Approval' : log.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headers.length} className="text-center py-8 text-gray-400 font-medium">No audit log records found.</td>
              </tr>
            )}
          </Table>
        </div>
      </div>
    </div>
  );
};

export default WalletAuditLogModal;
