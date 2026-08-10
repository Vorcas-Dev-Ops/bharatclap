"use client";

import React from 'react';
import { ShieldCheck, UserPlus, Key, Lock, Users, CheckCircle2, UserCheck } from 'lucide-react';

export default function RBACPage() {
  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Role-Based Access Control (RBAC)</h1>
          <p className="text-xs text-gray-500 font-medium">Manage Admin Roles, Granular Module Permissions, and Team Invitations</p>
        </div>

        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
          <UserPlus size={14} />
          Invite Admin User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Super Admin</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Full Access</span>
          </div>
          <p className="text-xs text-gray-500">Unrestricted access across all operational, financial, catalog, and system settings.</p>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Operations Manager</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Ops Access</span>
          </div>
          <p className="text-xs text-gray-500">Manage bookings, provider dispatch, live tracking, support CRM, and customer 360.</p>
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Finance Controller</h3>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">Finance Access</span>
          </div>
          <p className="text-xs text-gray-500">Manage settlements, payouts, COD collection, refund approvals, and tax reports.</p>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-8 text-center text-gray-400 border-dashed py-16 space-y-2">
        <ShieldCheck size={40} className="mx-auto text-blue-500 opacity-60" />
        <p className="text-xs font-bold text-gray-700">RBAC Security Policy Active</p>
        <p className="text-[10px] text-gray-400">Granular permission enforcement across all admin microservice API routes.</p>
      </div>
    </div>
  );
}
