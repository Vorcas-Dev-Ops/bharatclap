"use client";

import React, { useState, useEffect } from 'react';
import {
  Gift, Plus, Sparkles, CheckCircle2, XCircle, AlertTriangle, ShieldCheck,
  Edit2, Trash2, IndianRupee, Layers, ShoppingBag, Users, Clock, ArrowUpRight
} from 'lucide-react';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';
import LeadPackageModal from './LeadPackageModal';
import Table from '../common/Table';

const LeadPackagesPage: React.FC = () => {
  const [packages, setPackages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalPackages: 0,
    activePackages: 0,
    totalRevenue: 0,
    packagesSold: 0,
    lowLeadCount: 0,
    zeroLeadCount: 0,
    priorityCount: 0,
    rechargeHistory: []
  });

  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPackagesAndStats = async () => {
    try {
      setLoading(true);

      const [pkgRes, statRes] = await Promise.all([
        authFetch(`${API_URL}/providers/admin/lead-packages`),
        authFetch(`${API_URL}/providers/admin/lead-packages/stats`)
      ]);

      if (pkgRes && pkgRes.ok) {
        const pkgData = await pkgRes.json();
        setPackages(Array.isArray(pkgData) ? pkgData : []);
      }
      if (statRes && statRes.ok) {
        const statData = await statRes.json();
        setStats(statData || {});
      }
    } catch (err: any) {
      console.warn('[LeadPackagesPage] Notice loading packages:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackagesAndStats();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this lead package?')) return;
    try {
      const res = await authFetch(`${API_URL}/providers/admin/lead-packages/${id}`, {
        method: 'DELETE',
      });
      if (res && res.ok) {
        fetchPackagesAndStats();
      }
    } catch (err: any) {
      console.warn('[LeadPackagesPage] Delete error:', err?.message || err);
    }
  };

  const handleToggleActive = async (pkg: any) => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/lead-packages/${pkg._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !pkg.isActive }),
      });
      if (res && res.ok) {
        fetchPackagesAndStats();
      }
    } catch (err: any) {
      console.warn('[LeadPackagesPage] Toggle status error:', err?.message || err);
    }
  };

  const headers = ['Provider', 'Package', 'Price', 'Leads Granted', 'Status', 'Date'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl text-white shadow-md">
              <Gift size={22} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">Lead Package<span className="text-indigo-600"> Management</span></h1>
              <p className="text-xs text-gray-500 font-medium">Create unlimited lead packages, configure price & bonus leads, and monitor provider recharges.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => { setSelectedPackage(null); setIsModalOpen(true); }}
          className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 uppercase tracking-wider self-start md:self-auto"
        >
          <Plus size={16} />
          Create Package
        </button>
      </div>

      {/* Analytics KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Packages</span>
            <Layers size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{stats.totalPackages || packages.length}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Published</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{stats.activePackages || 0}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Packages Sold</span>
            <ShoppingBag size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{stats.packagesSold || 0}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Package Revenue</span>
            <IndianRupee size={16} className="text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 mt-2">₹{(stats.totalRevenue || 0).toLocaleString('en-IN')}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Low Leads (≤5)</span>
            <AlertTriangle size={16} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{stats.lowLeadCount || 0}</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">0 Leads</span>
            <XCircle size={16} className="text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 mt-2">{stats.zeroLeadCount || 0}</p>
        </div>
      </div>

      {/* Package Management Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
          <span>Configured Lead Packages</span>
          <span className="text-xs px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold">{packages.length}</span>
        </h2>

        {loading ? (
          <div className="p-12 text-center text-gray-400 font-medium">Loading lead packages...</div>
        ) : packages.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 text-gray-400 font-bold">
            No lead packages created yet. Click "Create Package" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {packages.map((pkg) => (
              <div
                key={pkg._id}
                className={`bg-white rounded-3xl p-6 border transition-all duration-300 relative flex flex-col justify-between ${
                  pkg.isActive ? 'border-gray-100 shadow-sm hover:shadow-md' : 'border-dashed border-gray-200 bg-gray-50/50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full ${
                        pkg.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {pkg.isActive ? 'Published' : 'Disabled'}
                      </span>
                      {pkg.badgeText && (
                        <span className="ml-2 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          {pkg.badgeText}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setSelectedPackage(pkg); setIsModalOpen(true); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Edit Package"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(pkg._id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Package"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-gray-900 tracking-tight">{pkg.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{pkg.description || 'Custom lead package for service experts.'}</p>

                  <div className="my-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-gray-900">₹{pkg.price}</span>
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                        {pkg.leads + (pkg.bonusLeads || 0)} Leads
                      </span>
                    </div>
                    {pkg.bonusLeads > 0 && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
                        <Sparkles size={10} /> {pkg.leads} Base + {pkg.bonusLeads} Free Bonus Leads
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 text-[11px] text-gray-600 font-medium">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Validity</span>
                      <span className="font-bold text-gray-900">{pkg.validityDays} Days</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Priority Dispatch</span>
                      <span className={`font-bold ${pkg.hasPriorityDispatch ? 'text-amber-600' : 'text-gray-400'}`}>
                        {pkg.hasPriorityDispatch ? '✨ Enabled (Boost)' : 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-bold">Status</span>
                  <button
                    onClick={() => handleToggleActive(pkg)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      pkg.isActive
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {pkg.isActive ? 'Disable Package' : 'Publish Package'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package Purchase & Recharge History Ledger Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Recent Package Recharges</h2>
            <p className="text-xs text-gray-500 font-medium">Real-time log of provider lead package purchases & Razorpay activations.</p>
          </div>
        </div>

        <Table headers={headers} compact>
          {stats.rechargeHistory && stats.rechargeHistory.length > 0 ? (
            stats.rechargeHistory.map((order: any) => (
              <tr key={order._id} className="hover:bg-blue-50/20 text-[11px] border-b border-gray-50">
                <td className="px-3 py-3 font-bold text-gray-900">
                  {order.provider_id?.user_id?.name || 'Service Provider'}
                </td>
                <td className="px-3 py-3 font-bold text-indigo-600">
                  {order.packageName}
                </td>
                <td className="px-3 py-3 font-black text-gray-900">
                  ₹{order.price}
                </td>
                <td className="px-3 py-3 font-bold text-emerald-600">
                  +{order.totalLeadsGranted} Leads
                </td>
                <td className="px-3 py-3">
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                    {order.paymentStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-400 font-medium">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="text-center py-8 text-gray-400 font-medium">
                No package recharge orders recorded yet.
              </td>
            </tr>
          )}
        </Table>
      </div>

      {/* Create / Edit Modal */}
      <LeadPackageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPackagesAndStats}
        packageData={selectedPackage}
      />
    </div>
  );
};

export default LeadPackagesPage;
