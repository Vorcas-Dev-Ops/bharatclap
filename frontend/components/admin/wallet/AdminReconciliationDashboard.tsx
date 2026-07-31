"use client";

import React, { useState, useEffect } from 'react';
import { 
  Scale, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Search, 
  Zap, 
  PlayCircle,
  Database,
  Clock
} from 'lucide-react';
import { message, Modal, Tag, Button, Tooltip } from 'antd';
import { apiClient } from '@/config/api';

interface ReconciliationStats {
  totalReconciliations: number;
  correctedBalances: number;
  failedReconciliations: number;
  dirtyProvidersQueue: number;
  largestDrift: number;
  recentLogs: any[];
  metricsSummary: {
    wallet_transactions_total: number;
    wallet_reconciliation_total: number;
    wallet_drift_total: number;
    wallet_negative_balance_attempts: number;
    wallet_adjustments_total: number;
    wallet_event_failures: number;
    wallet_idempotency_hits: number;
    wallet_average_latency_ms: number;
  };
}

export default function AdminReconciliationDashboard() {
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(false);
  const [stats, setStats] = useState<ReconciliationStats | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    fetchReconciliationStats();
  }, []);

  const fetchReconciliationStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/wallets/admin/reconciliation/stats');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Failed to load reconciliation stats", err);
      messageApi.error("Failed to load reconciliation telemetry");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerReconciliation = async (forceFullScan: boolean = false) => {
    try {
      setRunningJob(true);
      const res = await apiClient.post('/wallets/admin/reconciliation/trigger', { forceFullScan });
      const report = res.data?.report;
      messageApi.success(
        `Reconciliation completed! Scanned: ${report?.dirtyProvidersScanned || 0}, Discrepancies: ${report?.discrepanciesDetected || 0}`
      );
      fetchReconciliationStats();
    } catch (err: any) {
      console.error("Failed to run reconciliation job", err);
      messageApi.error(err.response?.data?.message || "Failed to execute reconciliation");
    } finally {
      setRunningJob(false);
    }
  };

  const logs = stats?.recentLogs || [];
  const filteredLogs = logs.filter(log => {
    const pName = log.provider_id?.name || log.provider_id?._id || '';
    const jobId = log.job_id || '';
    return pName.toLowerCase().includes(searchTerm.toLowerCase()) || jobId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {contextHolder}

      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Scale className="text-blue-600" size={24} /> Financial Ledger Reconciliation & Telemetry
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Background dirty-provider reconciliation, drift detection alerts, and OpenTelemetry mutation metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="primary"
            icon={<PlayCircle size={15} />}
            loading={runningJob}
            onClick={() => handleTriggerReconciliation(false)}
            className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10 bg-blue-600 border-none px-4 shadow-sm"
          >
            Reconcile Dirty Queue ({stats?.dirtyProvidersQueue || 0})
          </Button>

          <Button
            icon={<RefreshCw size={14} className={runningJob ? "animate-spin" : ""} />}
            onClick={() => handleTriggerReconciliation(true)}
            loading={runningJob}
            className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10 border-slate-200 shadow-sm"
          >
            Full Ledger Scan
          </Button>
        </div>
      </div>

      {/* Overview Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Jobs Executed</p>
          <p className="text-2xl font-black text-slate-900">{stats?.totalReconciliations || 0}</p>
          <p className="text-[10px] text-slate-400 font-semibold">Ledger Audit Runs</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Corrected Balances</p>
          <p className="text-2xl font-black text-amber-600">{stats?.correctedBalances || 0}</p>
          <p className="text-[10px] text-amber-500 font-semibold">Drifts Corrected</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Failed Reconciliations</p>
          <p className="text-2xl font-black text-rose-600">{stats?.failedReconciliations || 0}</p>
          <p className="text-[10px] text-rose-500 font-semibold">Execution Errors</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Dirty Queue</p>
          <p className="text-2xl font-black text-indigo-600">{stats?.dirtyProvidersQueue || 0}</p>
          <p className="text-[10px] text-indigo-500 font-semibold">Pending Target Check</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-1">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Avg Mutation Latency</p>
          <p className="text-2xl font-black text-emerald-600">{stats?.metricsSummary?.wallet_average_latency_ms || 0} ms</p>
          <p className="text-[10px] text-emerald-500 font-semibold">OpenTelemetry Latency</p>
        </div>
      </div>

      {/* Reconciliation Logs Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Activity className="text-blue-600" size={18} /> Recent Reconciliation Activity Logs
          </h3>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search provider or job ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-slate-600">
            <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4">Job ID</th>
                <th className="py-3 px-4">Expected Ledger</th>
                <th className="py-3 px-4">Cached Document</th>
                <th className="py-3 px-4">Difference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">Loading reconciliation logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">No reconciliation activity logs found</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {log.provider_id?.name || log.provider_id?._id || 'Provider'}
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-600 font-bold">{log.job_id}</td>
                    <td className="py-3 px-4 font-black text-slate-900">₹{log.expected_balance}</td>
                    <td className="py-3 px-4 font-black text-slate-500">₹{log.actual_balance}</td>
                    <td className="py-3 px-4 font-black">
                      {log.difference !== 0 ? (
                        <span className="text-amber-600 font-extrabold">{log.difference > 0 ? `+₹${log.difference}` : `-₹${Math.abs(log.difference)}`}</span>
                      ) : (
                        <span className="text-slate-400">₹0</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {log.status === 'MATCH' && <Tag color="green" className="font-extrabold text-[10px] uppercase">MATCH</Tag>}
                      {log.status === 'CORRECTED' && <Tag color="gold" className="font-extrabold text-[10px] uppercase">CORRECTED</Tag>}
                      {log.status === 'FAILED' && <Tag color="red" className="font-extrabold text-[10px] uppercase">FAILED</Tag>}
                    </td>
                    <td className="py-3 px-4 text-slate-400 font-semibold">
                      {new Date(log.reconciled_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
