"use client";

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Clock, 
  FileText, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Search, 
  RefreshCw,
  Lock,
  Unlock,
  Layers,
  BarChart3
} from 'lucide-react';
import { message, Modal, Tabs, Tag, Button } from 'antd';
import { apiClient } from '@/config/api';

interface OverrideState {
  disasterRecoveryMode: 'dual_verification' | 'registered_location_mode' | 'emergency_override';
  reason?: string;
  enabledBy?: string;
  expiresAt?: string;
}

interface AuditLogItem {
  _id: string;
  correlation_id: string;
  booking_id?: string;
  provider_id: any;
  location_id: any;
  action: string;
  changed_by: string;
  reason?: string;
  before: any;
  after: any;
  timestamp: string;
}

export default function AdminServiceAreaManagement() {
  const [activeTab, setActiveTab] = useState("override");
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Override State
  const [overrideState, setOverrideState] = useState<OverrideState>({
    disasterRecoveryMode: 'dual_verification'
  });
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<'dual_verification' | 'registered_location_mode' | 'emergency_override'>('emergency_override');
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDurationMinutes, setOverrideDurationMinutes] = useState(120);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState("");

  useEffect(() => {
    fetchDispatchSettings();
    fetchAuditLogs();
  }, []);

  const fetchDispatchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/providers/admin/settings/dispatch');
      if (res.data) {
        setOverrideState({
          disasterRecoveryMode: res.data.disasterRecoveryMode || 'dual_verification',
          reason: res.data.overrideReason,
          enabledBy: res.data.overrideEnabledBy,
          expiresAt: res.data.overrideExpiresAt
        });
      }
    } catch (err) {
      console.error("Failed to fetch dispatch settings", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await apiClient.get('/providers/admin/audit-logs');
      if (Array.isArray(res.data)) {
        setAuditLogs(res.data);
      } else if (res.data?.data) {
        setAuditLogs(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    }
  };

  const handleApplyOverride = async () => {
    if (overrideReason.trim().length < 20) {
      messageApi.error("A mandatory reason of at least 20 characters is required for override logging.");
      return;
    }

    try {
      setSubmittingOverride(true);
      const expiresAt = new Date(Date.now() + overrideDurationMinutes * 60 * 1000).toISOString();

      await apiClient.put('/providers/admin/settings/dispatch', {
        disasterRecoveryMode: targetMode,
        overrideReason,
        overrideExpiresAt: expiresAt
      });

      messageApi.success("Dispatch emergency mode updated successfully!");
      setOverrideModalOpen(false);
      setOverrideReason("");
      fetchDispatchSettings();
    } catch (err: any) {
      console.error("Failed to apply override", err);
      messageApi.error(err.response?.data?.message || "Failed to update dispatch mode");
    } finally {
      setSubmittingOverride(false);
    }
  };

  const filteredLogs = auditLogs.filter(log => 
    log.correlation_id?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.reason?.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {contextHolder}

      {/* Active Emergency Banner */}
      {overrideState.disasterRecoveryMode !== 'dual_verification' && (
        <div className="p-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-slate-950 rounded-3xl shadow-lg shadow-amber-900/20 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-950/10 flex items-center justify-center shrink-0">
              <ShieldAlert className="text-slate-950" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wider">⚠ Emergency Dispatch Override Active</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-400 font-extrabold text-[10px] uppercase">
                  {overrideState.disasterRecoveryMode}
                </span>
              </div>
              <p className="text-xs font-semibold opacity-90 mt-0.5">
                Reason: {overrideState.reason || 'Surge override active'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              setTargetMode('dual_verification');
              setOverrideReason("System restored to standard production Dual Verification mode.");
              setOverrideModalOpen(true);
            }}
            className="bg-slate-950 text-amber-400 border-none font-extrabold text-xs uppercase tracking-wider rounded-xl h-10 px-5 shadow-md hover:bg-slate-900 cursor-pointer"
          >
            Restore Default (Dual Verification)
          </Button>
        </div>
      )}

      {/* Header & Sub-Tabs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Layers className="text-blue-600" size={24} /> Service Area & Dispatch Governance
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Super-Admin operational mode controls, exclusion telemetry funnels, and immutable audit logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTargetMode('emergency_override');
                setOverrideReason("");
                setOverrideModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md cursor-pointer"
            >
              <ShieldAlert size={16} /> Emergency Override
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="custom-tabs"
          items={[
            { key: 'override', label: 'Dispatch Mode Governance' },
            { key: 'telemetry', label: 'Exclusion Telemetry Funnel' },
            { key: 'audit', label: `Immutable Audit Logs (${auditLogs.length})` },
          ]}
        />
      </div>

      {/* Tab 1: Dispatch Mode Governance */}
      {activeTab === 'override' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className={`p-6 rounded-3xl border transition-all space-y-4 shadow-sm ${
            overrideState.disasterRecoveryMode === 'dual_verification' ? 'bg-blue-50/50 border-blue-200 ring-2 ring-blue-500/20' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">1</span>
              {overrideState.disasterRecoveryMode === 'dual_verification' && (
                <Tag color="blue" className="font-extrabold text-[10px] uppercase">ACTIVE DEFAULT</Tag>
              )}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Dual Verification</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Registered Location + Live GPS Proximity. Standard production mode enforcing dual location authorization.
              </p>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all space-y-4 shadow-sm ${
            overrideState.disasterRecoveryMode === 'registered_location_mode' ? 'bg-amber-50/50 border-amber-200 ring-2 ring-amber-500/20' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">2</span>
              {overrideState.disasterRecoveryMode === 'registered_location_mode' && (
                <Tag color="gold" className="font-extrabold text-[10px] uppercase">ACTIVE OVERRIDE</Tag>
              )}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Registered Location Mode</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Dispatches based on registered service locations only. Ignores live GPS ping data (e.g. during GPS sensor outage).
              </p>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all space-y-4 shadow-sm ${
            overrideState.disasterRecoveryMode === 'emergency_override' ? 'bg-rose-50/50 border-rose-200 ring-2 ring-rose-500/20' : 'bg-white border-slate-100'
          }`}>
            <div className="flex items-center justify-between">
              <span className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-black">3</span>
              {overrideState.disasterRecoveryMode === 'emergency_override' && (
                <Tag color="red" className="font-extrabold text-[10px] uppercase">ACTIVE OVERRIDE</Tag>
              )}
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Emergency Override</h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                GPS Live Proximity Surge Override. Bypasses registered location check during severe weather or high demand.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Exclusion Telemetry Funnel */}
      {activeTab === 'telemetry' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={20} /> Dispatch Candidate Exclusion Funnel
          </h3>
          
          <div className="space-y-3 max-w-2xl">
            {[
              { label: "Total Registered Providers", count: 500, percent: "100%", color: "bg-blue-600" },
              { label: "Filtered: Wrong Subservice", count: 120, percent: "24%", color: "bg-slate-400" },
              { label: "Filtered: Area Paused / Out of Schedule", count: 80, percent: "16%", color: "bg-amber-500" },
              { label: "Filtered: Daily Area Capacity Exceeded", count: 15, percent: "3%", color: "bg-purple-500" },
              { label: "Filtered: Wallet / Subscription Low", count: 45, percent: "9%", color: "bg-rose-500" },
              { label: "Filtered: Provider Busy / On Break", count: 85, percent: "17%", color: "bg-orange-500" },
              { label: "Filtered: Live GPS Radius (>30km)", count: 35, percent: "7%", color: "bg-indigo-500" },
              { label: "Final Eligible Candidates Pool", count: 120, percent: "24%", color: "bg-emerald-600" },
            ].map((step, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>{step.label}</span>
                  <span>{step.count} ({step.percent})</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${step.color}`} style={{ width: step.percent }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search correlation ID or action..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
              />
            </div>
            <Button icon={<RefreshCw size={14} />} onClick={fetchAuditLogs} className="rounded-xl text-xs font-bold">Refresh</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium text-slate-600">
              <thead className="bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Correlation ID</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Changed By</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">No audit records found</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{log.correlation_id || '—'}</td>
                      <td className="py-3 px-4 font-black text-slate-800">
                        <Tag color={log.action.includes('ENABLED') ? 'green' : 'amber'}>{log.action}</Tag>
                      </td>
                      <td className="py-3 px-4 uppercase font-bold text-slate-500">{log.changed_by}</td>
                      <td className="py-3 px-4 text-slate-700">{log.reason || '—'}</td>
                      <td className="py-3 px-4 font-bold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Emergency Override Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldAlert className="text-amber-500" size={20} />
            <span className="font-black uppercase tracking-tight">Super-Admin Emergency Override</span>
          </div>
        }
        open={overrideModalOpen}
        onCancel={() => setOverrideModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOverrideModalOpen(false)} className="rounded-xl font-bold text-xs uppercase h-10">Cancel</Button>,
          <Button
            key="confirm"
            type="primary"
            loading={submittingOverride}
            onClick={handleApplyOverride}
            className="rounded-xl font-bold text-xs uppercase h-10 bg-amber-500 hover:bg-amber-600 text-slate-950 border-none px-6"
          >
            Apply Emergency Mode
          </Button>
        ]}
        centered
        width={500}
        className="premium-modal"
      >
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Select Override Mode</label>
            <select
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as any)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none"
            >
              <option value="dual_verification">Dual Verification (Standard Default)</option>
              <option value="registered_location_mode">Registered Location Mode (Ignore GPS pings)</option>
              <option value="emergency_override">Emergency GPS-Only Mode (Bypass Registered Zone)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
              Mandatory Reason (Min 20 Characters) <span className="text-rose-500">*</span>
            </label>
            <textarea
              placeholder="State clear operational justification (e.g. Heavy rain surge override in HSR Layout zone)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none min-h-[90px]"
            />
            <p className="text-[10px] text-right font-bold text-slate-400">{overrideReason.trim().length} / 20 characters minimum</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Auto-Expiry Duration</label>
            <select
              value={overrideDurationMinutes}
              onChange={(e) => setOverrideDurationMinutes(Number(e.target.value))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none"
            >
              <option value={60}>1 Hour</option>
              <option value={120}>2 Hours (Recommended)</option>
              <option value={240}>4 Hours</option>
              <option value={480}>8 Hours (Requires Dual Approval)</option>
            </select>
          </div>
        </div>
      </Modal>

    </div>
  );
}
