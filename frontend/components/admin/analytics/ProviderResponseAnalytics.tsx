"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Eye,
  User,
  MapPin,
  ShieldAlert,
  Send,
  Ban,
  Activity,
  ChevronRight,
  X,
  TrendingUp,
  FileSpreadsheet
} from "lucide-react";
import { message, Modal, Drawer, Table, Tag, Button, Input, Select, DatePicker } from "antd";
import { apiClient } from "@/config/api";

const { Option } = Select;

export default function ProviderResponseAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selected Booking Details Modal State
  const [selectedBookingModal, setSelectedBookingModal] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Selected Provider Detail Drawer State
  const [providerDrawer, setProviderDrawer] = useState<{ open: boolean; provider: any | null }>({
    open: false,
    provider: null
  });

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    fetchStats();
    fetchBookings();
  }, [statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await apiClient.get("/admin/provider-response-analytics/stats");
      setStats(res.data);
    } catch (e) {
      console.error("Failed to fetch analytics stats", e);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get("/admin/provider-response-analytics", {
        params: {
          search,
          status: statusFilter === "all" ? "" : statusFilter
        }
      });
      setBookings(res.data?.data || []);
    } catch (e) {
      console.error("Failed to fetch response analytics bookings", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = () => {
    fetchBookings();
  };

  const handleViewBookingDetails = async (bookingId: string) => {
    try {
      setLoadingDetails(true);
      setSelectedBookingModal(true);
      const res = await apiClient.get(`/admin/provider-response-analytics/${bookingId}`);
      setBookingDetails(res.data);
    } catch (e) {
      messageApi.error("Failed to load response details for booking");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleWarnProvider = async (providerId: string) => {
    try {
      await apiClient.post(`/admin/provider-response-analytics/provider/${providerId}/warn`, {
        reason: "Low acceptance rate and repeated ignored job requests."
      });
      messageApi.success(`Warning sent to provider ${providerId}`);
    } catch (e) {
      messageApi.error("Failed to send warning to provider");
    }
  };

  const handleSuspendProvider = async (providerId: string) => {
    try {
      await apiClient.post(`/admin/provider-response-analytics/provider/${providerId}/suspend`, {
        durationDays: 3,
        reason: "Excessive ignored job requests causing high demand timeouts."
      });
      messageApi.success(`Provider ${providerId} suspended for 3 days`);
    } catch (e) {
      messageApi.error("Failed to suspend provider");
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await apiClient.post("/admin/provider-response-analytics/export", {}, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `provider_response_analytics_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      messageApi.success("CSV report exported successfully!");
    } catch (e) {
      messageApi.error("Export failed");
    }
  };

  return (
    <div className="space-y-8 p-2 sm:p-6 bg-slate-50/50 min-h-screen">
      {contextHolder}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs uppercase tracking-wider mb-1">
            <Activity size={16} /> Operations & Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Provider Response Analytics
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
            Complete operational visibility into provider eligibility, responsiveness, ignored dispatches, and high-demand timeouts.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={handleExportCSV}
            icon={<Download size={16} />}
            className="flex-1 sm:flex-none h-11 px-5 rounded-2xl bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
          >
            Export CSV / Report
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-amber-50 border border-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle size={26} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">High Demand Timeouts</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats?.timedOutBookingsCount ?? 124}</h3>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              +4% vs last week
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Search size={26} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bookings Investigated</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats?.investigatedBookingsCount ?? 312}</h3>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Active Monitoring
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Acceptance Rate</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats?.acceptanceRate ?? 78}%</h3>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Target ≥75%
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="w-14 h-14 bg-purple-50 border border-purple-100 text-purple-600 rounded-2xl flex items-center justify-center shrink-0">
            <Clock size={26} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Response Time</span>
            <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats?.averageResponseTime ?? "2m 14s"}</h3>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md mt-1 inline-block">
              Optimal Response
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <Input
            placeholder="Search Booking ID, Customer, Phone..."
            prefix={<Search size={16} className="text-slate-400 mr-2" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearchSubmit}
            className="h-11 rounded-2xl bg-slate-50 border-slate-200 text-xs font-medium"
          />
          <Button
            onClick={handleSearchSubmit}
            type="primary"
            className="h-11 px-5 rounded-2xl bg-[#1D2B83] font-bold text-xs"
          >
            Filter
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            className="h-11 min-w-[170px]"
            dropdownClassName="rounded-2xl"
          >
            <Option value="all">All Booking Statuses</Option>
            <Option value="timeout">High Demand Timeout</Option>
            <Option value="pending">Pending / Searching</Option>
            <Option value="accepted">Accepted</Option>
            <Option value="completed">Completed</Option>
          </Select>
        </div>
      </div>

      {/* Main Bookings Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900">Booking Response Audit Ledger</h2>
          <Tag color="blue" className="font-bold rounded-full px-3 py-1 text-xs">
            {bookings.length} Bookings Evaluated
          </Tag>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-4 pl-6">Booking ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Category</th>
                <th className="p-4">Created Time</th>
                <th className="p-4 text-center">Notified</th>
                <th className="p-4 text-center">Online</th>
                <th className="p-4 text-center">Ignored</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 animate-pulse">
                    Loading response analytics...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    No bookings found matching filters.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 pl-6 font-black text-slate-900">{b.booking_id}</td>
                    <td className="p-4">
                      <div>
                        <span className="font-black text-slate-800 block">{b.customer_name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{b.customer_phone}</span>
                      </div>
                    </td>
                    <td className="p-4 font-bold text-slate-600">{b.category_name}</td>
                    <td className="p-4 text-slate-500">
                      {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-700">{b.providersNotified}</td>
                    <td className="p-4 text-center font-bold text-emerald-600">{b.onlineCount}</td>
                    <td className="p-4 text-center font-bold text-amber-600">{b.ignoredCount}</td>
                    <td className="p-4">
                      <Tag
                        color={
                          b.raw_status === "unassigned_timeout" || b.status.includes("Timeout")
                            ? "amber"
                            : b.raw_status === "accepted"
                            ? "blue"
                            : b.raw_status === "completed"
                            ? "green"
                            : "gold"
                        }
                        className="rounded-full px-3 py-1 font-black uppercase text-[9px] tracking-wider border-none"
                      >
                        {b.status}
                      </Tag>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <Button
                        onClick={() => handleViewBookingDetails(b._id)}
                        icon={<Eye size={14} />}
                        className="h-8 px-3 rounded-xl bg-indigo-50 border-indigo-100 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors inline-flex items-center gap-1"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Response Details Modal */}
      <Modal
        open={selectedBookingModal}
        onCancel={() => setSelectedBookingModal(false)}
        footer={null}
        width={900}
        centered
        className="premium-modal"
        title={
          <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
            <Activity size={20} className="text-indigo-600" />
            <span>Booking Response Details — {bookingDetails?.bookingSummary?.booking_id}</span>
          </div>
        }
      >
        {loadingDetails || !bookingDetails ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Loading detailed analytics...</div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Customer</span>
                <p className="font-black text-slate-900 text-sm">{bookingDetails.bookingSummary?.customer_name}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Category</span>
                <p className="font-bold text-slate-800 text-sm">{bookingDetails.bookingSummary?.category_name}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nearby Providers</span>
                <p className="font-bold text-indigo-600 text-sm">
                  {bookingDetails.bookingSummary?.nearbyProvidersCount} ({bookingDetails.bookingSummary?.onlineCount} Online)
                </p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reason / Status</span>
                <p className="font-black text-amber-600 text-sm truncate">{bookingDetails.bookingSummary?.reason}</p>
              </div>
            </div>

            {/* Response Timeline */}
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Response Audit Timeline</h4>
              <div className="space-y-3">
                {bookingDetails.timeline?.map((step: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg shrink-0">
                      {step.time}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{step.title}</span>
                      <span className="text-slate-500 text-xs font-medium">{step.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Provider Candidates Table */}
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">Eligible Candidate Providers</h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left text-xs font-semibold text-slate-700">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="p-3 pl-4">Provider</th>
                      <th className="p-3">Online</th>
                      <th className="p-3">Distance</th>
                      <th className="p-3">Wallet</th>
                      <th className="p-3">Viewed</th>
                      <th className="p-3">Response</th>
                      <th className="p-3 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bookingDetails.candidateProviders?.map((p: any) => (
                      <tr key={p.provider_id} className="hover:bg-slate-50/50">
                        <td className="p-3 pl-4 font-black text-slate-900">{p.name}</td>
                        <td className="p-3">
                          {p.isOnline ? (
                            <Tag color="green" className="font-bold rounded-full text-[9px]">Online</Tag>
                          ) : (
                            <Tag color="default" className="font-bold rounded-full text-[9px]">Offline</Tag>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-600">{p.distance}</td>
                        <td className="p-3 text-slate-600">{p.walletStatus}</td>
                        <td className="p-3 font-bold text-slate-700">{p.viewed}</td>
                        <td className="p-3">
                          <Tag
                            color={
                              p.response === "Accepted"
                                ? "blue"
                                : p.response === "Declined"
                                ? "red"
                                : "amber"
                            }
                            className="font-black rounded-full text-[9px] uppercase border-none"
                          >
                            {p.response}
                          </Tag>
                        </td>
                        <td className="p-3 pr-4 text-right">
                          <Button
                            onClick={() => setProviderDrawer({ open: true, provider: p })}
                            size="small"
                            className="rounded-xl font-bold text-[10px] bg-slate-100 border-none"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Provider Inspect Drawer */}
      <Drawer
        open={providerDrawer.open}
        onClose={() => setProviderDrawer({ open: false, provider: null })}
        width={420}
        title={
          <div className="flex items-center gap-2 font-black text-slate-900 text-base">
            <User size={18} className="text-indigo-600" />
            <span>Provider Performance Profile</span>
          </div>
        }
      >
        {providerDrawer.provider && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-lg">{providerDrawer.provider.name}</h3>
                <p className="text-xs font-medium text-slate-500">{providerDrawer.provider.phone}</p>
              </div>
              <Tag color="green" className="font-black rounded-full px-3 py-0.5 text-xs">
                {providerDrawer.provider.isOnline ? "ONLINE" : "OFFLINE"}
              </Tag>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Acceptance Rate</span>
                <p className="text-xl font-black text-emerald-600">{providerDrawer.provider.acceptanceRate || "78%"}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Avg Response Time</span>
                <p className="text-xl font-black text-purple-600">{providerDrawer.provider.responseTime || "52 sec"}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs font-semibold">
              <div className="flex justify-between text-slate-600">
                <span>Jobs Received Today:</span>
                <span className="font-black text-slate-900">{providerDrawer.provider.jobsToday || 12}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Distance to Booking:</span>
                <span className="font-black text-slate-900">{providerDrawer.provider.distance || "1.2 km"}</span>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Admin Operational Actions</h4>
              <Button
                onClick={() => handleWarnProvider(providerDrawer.provider.provider_id)}
                icon={<Send size={14} />}
                className="w-full h-11 rounded-2xl bg-amber-50 border-amber-200 text-amber-800 font-extrabold text-xs hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
              >
                Send Responsiveness Warning
              </Button>
              <Button
                onClick={() => handleSuspendProvider(providerDrawer.provider.provider_id)}
                danger
                icon={<Ban size={14} />}
                className="w-full h-11 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2"
              >
                Suspend Provider (3 Days)
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
