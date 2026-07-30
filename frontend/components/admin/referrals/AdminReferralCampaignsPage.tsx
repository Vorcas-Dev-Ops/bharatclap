"use client";

import React, { useState, useEffect } from "react";
import AdminLayout from "../layout/AdminLayout";
import {
  Gift,
  Plus,
  Copy,
  Pause,
  Play,
  CheckCircle2,
  Calendar,
  Award,
  Layers,
  Sparkles,
  Sliders,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { message, Modal, Switch } from "antd";
import { authFetch } from "@/utils/authFetch";
import { API_URL } from "@/config/api";

export default function AdminReferralCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    priority: 10,
    rewardAmount: 500,
    rewardType: "wallet_credit",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    expiryDays: 30,
    status: "active",
    qualificationRules: {
      minCompletedJobs: 1,
      minEarnings: 0,
      minRating: 0,
      kycRequired: true,
      starterKitRequired: false,
      walletActive: true,
    },
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/admin/referrals/campaigns`);
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await authFetch(`${API_URL}/providers/admin/referrals/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        message.success("Referral campaign created successfully!");
        setModalOpen(false);
        fetchCampaigns();
      } else {
        const err = await res.json();
        message.error(err.message || "Failed to create campaign");
      }
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      const res = await authFetch(`${API_URL}/providers/admin/referrals/campaigns/${campaignId}/duplicate`, {
        method: "POST",
      });
      if (res.ok) {
        message.success("Campaign duplicated into draft!");
        fetchCampaigns();
      }
    } catch (err) {
      message.error("Failed to duplicate campaign");
    }
  };

  const handleToggleStatus = async (campaign: any) => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    try {
      const res = await authFetch(`${API_URL}/providers/admin/referrals/campaigns/${campaign._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        message.success(`Campaign status set to ${newStatus}`);
        fetchCampaigns();
      }
    } catch (err) {
      message.error("Failed to update campaign status");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-700 mb-2">
              <Gift size={14} /> Admin Marketing Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Provider Referral Campaigns
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Create and manage prioritized referral campaigns with custom qualification rules and validity dates.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-900/20 transition flex items-center gap-2"
          >
            <Plus size={16} /> Create Campaign
          </button>
        </div>

        {/* Campaign List */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-100 text-center">
            <Gift size={40} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Active Referral Campaigns</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Create your first priority referral campaign to start rewarding service providers.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-black transition"
            >
              Create Campaign
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campaigns.map((c) => (
              <div
                key={c._id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 relative overflow-hidden flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase rounded-full">
                        Priority {c.priority}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full ${
                          c.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : c.status === "paused"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">{c.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(c.startDate).toLocaleDateString()} — {new Date(c.endDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-600">₹{c.rewardAmount}</span>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{c.rewardType}</p>
                  </div>
                </div>

                {/* Qualification Rules Preview */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 mb-6 space-y-1.5 text-xs text-slate-600 font-medium">
                  <div className="flex items-center justify-between">
                    <span>Min Completed Jobs Required:</span>
                    <span className="font-bold text-slate-900">{c.qualificationRules?.minCompletedJobs || 1} Job(s)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>KYC Verification Required:</span>
                    <span className="font-bold text-slate-900">{c.qualificationRules?.kycRequired ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Referral Expiry Window:</span>
                    <span className="font-bold text-slate-900">{c.expiryDays || 30} Days</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleStatus(c)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                  >
                    {c.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                    {c.status === "active" ? "Pause Campaign" : "Resume Campaign"}
                  </button>

                  <button
                    onClick={() => handleDuplicateCampaign(c._id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5"
                  >
                    <Copy size={14} /> Duplicate Draft
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Create Campaign */}
        <Modal
          title={<span className="text-lg font-black">Create Referral Campaign</span>}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={600}
        >
          <form onSubmit={handleCreateCampaign} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Campaign Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Monsoon Partner Drive 2026"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Priority (Higher = Higher Precedence)</label>
                <input
                  type="number"
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reward Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={formData.rewardAmount}
                  onChange={(e) => setFormData({ ...formData, rewardAmount: parseInt(e.target.value) || 500 })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs font-bold text-slate-900 mb-2 uppercase tracking-wider">Qualification Rules</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Min Completed Jobs Required</label>
                  <input
                    type="number"
                    value={formData.qualificationRules.minCompletedJobs}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        qualificationRules: {
                          ...formData.qualificationRules,
                          minCompletedJobs: parseInt(e.target.value) || 1,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Expiry Window (Days)</label>
                  <input
                    type="number"
                    value={formData.expiryDays}
                    onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) || 30 })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow"
              >
                {submitting ? "Creating..." : "Save Campaign"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
