"use client";

import React, { useState, useEffect, useMemo } from "react";
import { API_URL } from "@/config/api";
import { authFetch } from "@/utils/authFetch";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Calendar,
  TrendingUp,
  CreditCard,
  Banknote,
  Loader2,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Building,
  Building2,
  Clock,
  IndianRupee,
  Briefcase,
  Award,
  BarChart3,
  ShieldCheck,
  Zap,
  Timer,
  X,
} from "lucide-react";
import { message, Modal } from "antd";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// ponytail: derive all analytics from existing settlement data on frontend, zero new endpoints
function deriveAnalytics(settlements: any[], wallet: any) {
  const now = new Date();

  // Payment breakdown
  const onlineSettlements = settlements.filter((s: any) => s.payment_type === "online");
  const codSettlements = settlements.filter((s: any) => s.payment_type === "cod");
  const onlineTotal = onlineSettlements.reduce((sum: number, s: any) => sum + (s.gross_amount || 0), 0);
  const codTotal = codSettlements.reduce((sum: number, s: any) => sum + (s.gross_amount || 0), 0);
  const commissionTotal = settlements.reduce((sum: number, s: any) => sum + (s.commission_amount || 0), 0);
  const gstTotal = settlements.reduce((sum: number, s: any) => sum + (s.gst_on_commission || 0), 0);
  const tdsTotal = settlements.reduce((sum: number, s: any) => sum + (s.tds_amount || 0), 0);
  const tcsTotal = settlements.reduce((sum: number, s: any) => sum + (s.tcs_amount || 0), 0);
  const netEarnings = settlements.reduce((sum: number, s: any) => {
    const gross = s.gross_amount || 0;
    const comm = s.commission_amount || 0;
    const gst = s.gst_on_commission || 0;
    const tds = s.tds_amount || 0;
    const tcs = s.tcs_amount || 0;
    return sum + (s.payment_type === "online" ? (s.net_payable_amount || (gross - comm - gst - tds - tcs)) : (gross - comm - gst - tds - tcs));
  }, 0);

  // Status counts
  const statusCounts: Record<string, number> = {};
  for (const s of settlements) {
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }

  // Earnings insights
  const avgPerJob = settlements.length > 0
    ? netEarnings / settlements.length
    : 0;
  const highestSettlement = settlements.reduce(
    (max: number, s: any) => Math.max(max, s.gross_amount || 0), 0
  );
  const successCount = settlements.filter(
    (s: any) => s.status === "paid" || s.status === "cod_settled"
  ).length;
  const successRate = settlements.length > 0
    ? Math.round((successCount / settlements.length) * 100)
    : 100;

  // COD countdown — earliest cod_due_by from pending COD
  const pendingCod = settlements
    .filter((s: any) => s.status === "cod_pending" && s.cod_due_by)
    .map((s: any) => new Date(s.cod_due_by))
    .sort((a, b) => a.getTime() - b.getTime());
  const codDueDays = pendingCod.length > 0
    ? Math.max(0, Math.ceil((pendingCod[0].getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // 30-day trend — group settlements by date
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dailyMap = new Map<string, { earnings: number; jobs: number }>();
  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { earnings: 0, jobs: 0 });
  }
  for (const s of settlements) {
    const day = new Date(s.createdAt).toISOString().split("T")[0];
    if (dailyMap.has(day)) {
      const entry = dailyMap.get(day)!;
      const net = (s.gross_amount || 0) - (s.commission_amount || 0) - (s.gst_on_commission || 0) - (s.tds_amount || 0) - (s.tcs_amount || 0);
      entry.earnings += net;
      entry.jobs += 1;
    }
  }
  const trendData = Array.from(dailyMap.entries()).map(([date, vals]) => ({
    date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    earnings: Math.round(vals.earnings),
    jobs: vals.jobs,
  }));

  // Top earning day
  let topDay = { date: "—", earnings: 0 };
  for (const [date, vals] of dailyMap.entries()) {
    if (vals.earnings > topDay.earnings) {
      topDay = {
        date: new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        earnings: Math.round(vals.earnings),
      };
    }
  }

  // Online vs COD doughnut
  const paymentTypeData = [
    { name: "Online", value: onlineTotal, color: "#3B82F6" },
    { name: "Cash (COD)", value: codTotal, color: "#8B5CF6" },
  ].filter((d) => d.value > 0);

  // Status pie
  const STATUS_COLORS: Record<string, string> = {
    pending_hold: "#F59E0B",
    ready_for_payout: "#3B82F6",
    paid: "#10B981",
    cod_pending: "#8B5CF6",
    cod_settled: "#06B6D4",
    held_by_admin: "#EF4444",
    failed: "#DC2626",
    processing: "#6366F1",
  };
  const statusPieData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.replace(/_/g, " "),
    value: count,
    color: STATUS_COLORS[status] || "#94A3B8",
  }));

  // Today & Month derived calculations (fail-safe for frontend)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todaySettlements = settlements.filter((s: any) => new Date(s.createdAt) >= startOfToday);
  const monthSettlements = settlements.filter((s: any) => new Date(s.createdAt) >= startOfMonth);

  const todayEarnings = todaySettlements.reduce((sum: number, s: any) => {
    const gross = s.gross_amount || 0;
    const comm = s.commission_amount || 0;
    const gst = s.gst_on_commission || 0;
    const tds = s.tds_amount || 0;
    const tcs = s.tcs_amount || 0;
    return sum + (s.payment_type === "online" ? (s.net_payable_amount || (gross - comm - gst - tds - tcs)) : (gross - comm - gst - tds - tcs));
  }, 0);

  const monthEarnings = monthSettlements.reduce((sum: number, s: any) => {
    const gross = s.gross_amount || 0;
    const comm = s.commission_amount || 0;
    const gst = s.gst_on_commission || 0;
    const tds = s.tds_amount || 0;
    const tcs = s.tcs_amount || 0;
    return sum + (s.payment_type === "online" ? (s.net_payable_amount || (gross - comm - gst - tds - tcs)) : (gross - comm - gst - tds - tcs));
  }, 0);

  // ponytail: online/COD counts + outstanding COD from existing data
  const onlineCount = onlineSettlements.length;
  const codCount = codSettlements.length;
  const codCollected = codSettlements.reduce((sum: number, s: any) => sum + (s.gross_amount || 0), 0);
  const codDeposited = codSettlements.filter((s: any) => s.status === 'cod_settled').reduce((sum: number, s: any) => sum + (s.cod_due_amount || 0), 0);
  const outstandingCod = codSettlements.filter((s: any) => s.status === 'cod_pending').reduce((sum: number, s: any) => sum + (s.cod_due_amount || 0), 0);
  const pendingSettlements = settlements.filter((s: any) => ['pending_hold', 'ready_for_payout', 'processing'].includes(s.status)).length;

  // Service value = total gross
  const serviceValue = onlineTotal + codTotal;

  // Next payout: sum of ready_for_payout settlements, earliest hold_ends_at for pending_hold
  const readyForPayout = settlements.filter((s: any) => s.status === 'ready_for_payout');
  const nextPayoutAmount = readyForPayout.reduce((sum: number, s: any) => sum + (s.net_payable_amount || 0), 0);
  const pendingHoldSettlements = settlements.filter((s: any) => s.status === 'pending_hold' && s.hold_ends_at);
  const earliestHoldEnd = pendingHoldSettlements.length > 0
    ? new Date(Math.min(...pendingHoldSettlements.map((s: any) => new Date(s.hold_ends_at).getTime())))
    : null;
  const nextPayoutDate = readyForPayout.length > 0 ? 'Ready Now' : earliestHoldEnd
    ? earliestHoldEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return {
    onlineTotal, codTotal, commissionTotal, gstTotal, tdsTotal, tcsTotal, netEarnings,
    serviceValue,
    todayEarnings, todayOrders: todaySettlements.length,
    monthEarnings, monthOrders: monthSettlements.length,
    statusCounts, avgPerJob, highestSettlement, successRate, codDueDays,
    trendData, topDay, paymentTypeData, statusPieData,
    onlineCount, codCount, codCollected, codDeposited, outstandingCod, pendingSettlements,
    nextPayoutAmount, nextPayoutDate,
  };
}

const STATUS_BADGE: Record<string, string> = {
  pending_hold: "bg-amber-50 text-amber-600 border-amber-100",
  ready_for_payout: "bg-blue-50 text-blue-600 border-blue-100",
  paid: "bg-emerald-50 text-emerald-600 border-emerald-100",
  cod_pending: "bg-purple-50 text-purple-600 border-purple-100",
  cod_settled: "bg-cyan-50 text-cyan-600 border-cyan-100",
  held_by_admin: "bg-rose-50 text-rose-600 border-rose-100",
  failed: "bg-red-50 text-red-600 border-red-100",
  processing: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cod", label: "COD" },
  { id: "hold", label: "Hold" },
];

export default function EarningsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [data, setData] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [leadPackages, setLeadPackages] = useState<any[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [remitting, setRemitting] = useState(false);
  const [purchasingPkgId, setPurchasingPkgId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState("all");
  const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
  const [walletTxns, setWalletTxns] = useState<any[]>([]);
  const [showHubModal, setShowHubModal] = useState(false);

  // Bank Form State
  const [bankForm, setBankForm] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifscCode: "",
    bankName: "",
  });
  const [updatingBank, setUpdatingBank] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);

  useEffect(() => {
    fetchData();
    fetchLeadPackages();

    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchLeadPackages = async () => {
    try {
      setPackagesLoading(true);
      const res = await authFetch(`${API_URL}/providers/lead-packages`);
      if (res.ok) {
        const pkgs = await res.json();
        setLeadPackages(Array.isArray(pkgs) ? pkgs : []);
      }
    } catch (e) {
      console.error("Failed to fetch lead packages", e);
    } finally {
      setPackagesLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [earningsRes, walletRes, analyticsRes, txnRes] = await Promise.all([
        authFetch(`${API_URL}/providers/earnings-payouts`),
        authFetch(`${API_URL}/providers/wallet/balance`),
        authFetch(`${API_URL}/providers/dashboard-analytics`),
        authFetch(`${API_URL}/providers/wallet/transactions`),
      ]);

      if (earningsRes.ok && walletRes.ok) {
        const earningsData = await earningsRes.json();
        const walletData = await walletRes.json();
        const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null;
        setData(earningsData);
        setWallet(walletData);
        setAnalytics(analyticsData);
        if (txnRes.ok) {
          const txnData = await txnRes.json();
          setWalletTxns(Array.isArray(txnData) ? txnData : []);
        }

        // Prepopulate bank form
        if (
          earningsData.bankStatus !== "not_configured" &&
          earningsData.settlementHistory?.[0]?.provider_id?.bankDetails
        ) {
          const bank = earningsData.settlementHistory[0].provider_id.bankDetails;
          setBankForm({
            accountHolderName: bank.accountHolderName || "",
            accountNumber: bank.accountNumber || "",
            ifscCode: bank.ifscCode || "",
            bankName: bank.bankName || "",
          });
        }
      }
    } catch (error) {
      console.error("Error fetching earnings data:", error);
      messageApi.error("Failed to load earnings data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdatingBank(true);
      const res = await authFetch(`${API_URL}/providers/bank-details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      if (res.ok) {
        messageApi.success("Bank details updated successfully!");
        setShowBankModal(false);
        fetchData();
      } else {
        const errData = await res.json();
        messageApi.error(errData.message || "Failed to update bank details");
      }
    } catch (err) {
      messageApi.error("An error occurred");
    } finally {
      setUpdatingBank(false);
    }
  };

  const handleRemitCOD = async () => {
    if (!data || data.codDues <= 0) return;
    try {
      setRemitting(true);
      const res = await authFetch(`${API_URL}/providers/wallet/remit-cod`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: data.codDues }),
      });

      if (!res.ok) {
        const errData = await res.json();
        messageApi.error(errData.message || "Failed to remit COD dues");
        return;
      }

      const remitRes = await res.json();

      if (remitRes.method === "wallet") {
        messageApi.success(remitRes.message || "COD dues paid successfully using wallet credit!");
        fetchData();
        return;
      }

      if (remitRes.method === "online" && remitRes.razorpayOrder) {
        const orderToUse = remitRes.razorpayOrder;
        const options = {
          key: remitRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_mock",
          amount: orderToUse.amount,
          currency: orderToUse.currency || "INR",
          name: "BharatClap COD Remittance",
          description: `Pay Outstanding COD Dues (₹${remitRes.amount})`,
          order_id: orderToUse.id,
          handler: async function (response: any) {
            try {
              const verifyRes = await authFetch(`${API_URL}/providers/wallet/remit-cod/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  amount: remitRes.amount,
                }),
              });

              if (verifyRes.ok) {
                messageApi.success("COD dues remitted successfully via online payment!");
                fetchData();
              } else {
                messageApi.error("Online payment verification failed.");
              }
            } catch (err) {
              messageApi.error("Error verifying payment.");
            }
          },
          theme: { color: "#1D2B83" },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      messageApi.error(err.message || "Failed to process COD remittance");
    } finally {
      setRemitting(false);
    }
  };

  const handlePurchasePackage = async (pkg: any) => {
    try {
      setPurchasingPkgId(pkg._id);
      const orderRes = await authFetch(
        `${API_URL}/providers/lead-packages/purchase`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageId: pkg._id }),
        }
      );

      if (!orderRes.ok) {
        throw new Error(await orderRes.text());
      }

      const orderData = await orderRes.json();

      if (orderData.freeAccess) {
        messageApi.success(
          orderData.message || `Activated package "${pkg.name}" with Free Access!`
        );
        fetchData();
        return;
      }

      const orderToUse =
        orderData.razorpayOrder || orderData.rzpOrder || orderData.order;
      const options = {
        key:
          orderData.key_id ||
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
          "rzp_test_mock",
        amount: orderToUse.amount,
        currency: orderToUse.currency || "INR",
        name: "BharatClap Lead Package",
        description: `Purchase Package: ${pkg.name} (₹${pkg.price})`,
        order_id: orderToUse.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await authFetch(
              `${API_URL}/providers/lead-packages/verify`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              }
            );

            if (verifyRes.ok) {
              messageApi.success(
                `Package "${pkg.name}" purchased successfully!`
              );
              fetchData();
            } else {
              messageApi.error("Payment verification failed.");
            }
          } catch (err) {
            messageApi.error("Error verifying payment.");
          }
        },
        theme: {
          color: "#1D2B83",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      messageApi.error(err.message || "Failed to initiate package purchase");
    } finally {
      setPurchasingPkgId(null);
    }
  };

  // Derived analytics — memoized on settlements array
  const derived = useMemo(() => {
    if (!data?.settlementHistory) return null;
    return deriveAnalytics(data.settlementHistory, wallet);
  }, [data?.settlementHistory, wallet]);

  // Filtered settlements for table
  const filteredSettlements = useMemo(() => {
    const history = data?.settlementHistory || [];
    if (tableFilter === "all") return history;
    if (tableFilter === "paid") return history.filter((s: any) => s.status === "paid" || s.status === "cod_settled");
    if (tableFilter === "pending") return history.filter((s: any) => s.status === "pending_hold");
    if (tableFilter === "cod") return history.filter((s: any) => s.status === "cod_pending" || s.payment_type === "cod");
    if (tableFilter === "hold") return history.filter((s: any) => s.status === "held_by_admin");
    return history;
  }, [data?.settlementHistory, tableFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-sm">
          Loading earnings & payout details...
        </p>
      </div>
    );
  }

  // Credit Card properties
  const balance = wallet?.walletBalance || 0;
  const reserved = wallet?.reservedBalance || 0;
  const limit = wallet?.creditLimit || 0;
  const availableCredit = balance - reserved + limit;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {contextHolder}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Finance Dashboard
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Track earnings, settlements, and payment analytics in one place.
          </p>
        </div>
        <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm">
          <Download className="h-4 w-4" />
          Export Statement
        </button>
      </div>

      {/* ━━━ 1. Earnings Summary KPI Cards ━━━ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today&apos;s Earnings</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><IndianRupee size={16} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            ₹{Number(((derived?.todayEarnings || analytics?.todayRevenue) || 0).toFixed(2)).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">{(derived?.todayOrders ?? analytics?.todayOrders) || 0} Jobs</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">This Month</span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl group-hover:scale-110 transition-transform"><Calendar size={16} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900">
            ₹{Number(((derived?.monthEarnings || analytics?.monthRevenue) || 0).toFixed(2)).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] font-bold text-violet-600 mt-1">{(derived?.monthOrders ?? analytics?.monthOrders) || 0} Jobs</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet Balance</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform"><WalletIcon size={16} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900">₹{balance.toLocaleString("en-IN")}</p>
          <p className="text-[10px] font-bold text-amber-600 mt-1">₹{availableCredit.toLocaleString("en-IN")} Available</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Earnings</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><TrendingUp size={16} /></div>
          </div>
          <p className="text-2xl font-black text-emerald-600">
            ₹{Number((derived?.netEarnings || 0).toFixed(2)).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">After all deductions</p>
        </div>

        {/* Next Payout Card */}
        <div className="bg-white p-5 rounded-3xl border border-sky-100 shadow-sm group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Payout</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl group-hover:scale-110 transition-transform"><ArrowUpRight size={16} /></div>
          </div>
          <p className="text-2xl font-black text-sky-600">
            ₹{Number((derived?.nextPayoutAmount || 0).toFixed(2)).toLocaleString("en-IN")}
          </p>
          <p className="text-[10px] font-bold text-sky-500 mt-1">{derived?.nextPayoutDate || 'No pending payouts'}</p>
        </div>
      </div>

      {/* ━━━ 1b. Finance Overview Row (Online / COD / Outstanding) ━━━ */}
      {derived && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "Online Jobs", value: String(derived.onlineCount), color: "text-blue-600", bg: "bg-blue-50", icon: CreditCard },
            { label: "COD Jobs", value: String(derived.codCount), color: "text-purple-600", bg: "bg-purple-50", icon: Banknote },
            { label: "COD Collected", value: `₹${derived.codCollected.toLocaleString("en-IN")}`, color: "text-indigo-600", bg: "bg-indigo-50", icon: ArrowDownLeft },
            { label: "COD Deposited", value: `₹${derived.codDeposited.toLocaleString("en-IN")}`, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
            { label: "Outstanding COD", value: `₹${derived.outstandingCod.toLocaleString("en-IN")}`, color: derived.outstandingCod > 0 ? "text-rose-600" : "text-slate-400", bg: derived.outstandingCod > 0 ? "bg-rose-50" : "bg-slate-50", icon: AlertTriangle },
            { label: "Pending Settlements", value: String(derived.pendingSettlements), color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={`${bg} p-3 rounded-2xl text-center`}>
              <div className={`mx-auto w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${color} bg-white/60`}><Icon size={12} /></div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
              <p className={`text-sm font-black ${color} mt-0.5`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ━━━ 1c. Outstanding COD Action Banner ━━━ */}
      {derived && derived.outstandingCod > 0 && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-purple-700/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/30 text-purple-200 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-purple-400/30">Action Required</span>
              <span className="text-xs font-bold text-amber-300">Deposit Before Today 7:00 PM</span>
            </div>
            <p className="text-xs text-purple-200">Outstanding Cash on Delivery (COD) Collected</p>
            <p className="text-3xl font-black text-white">₹{derived.outstandingCod.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => handleRemitCOD()}
              disabled={remitting}
              className="flex-1 md:flex-initial px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
            >
              <CreditCard size={14} /> Pay Online (UPI / GPay)
            </button>
            <button
              onClick={() => setShowHubModal(true)}
              className="flex-1 md:flex-initial px-5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Building2 size={14} /> Nearest Hub
            </button>
          </div>
        </div>
      )}

      {/* ━━━ Main 2-Column Layout ━━━ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-8">

          {/* ━━━ 2. Payment Breakdown (Service Value → Payment Method → Deductions → Net) ━━━ */}
          {derived && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-slate-900 mb-5">Payment Breakdown</h2>
              <div className="space-y-4">
                {/* Service Value */}
                <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-2xl">
                  <span className="text-xs font-black text-slate-700">Service Value</span>
                  <span className="text-lg font-black text-slate-900">₹{Number(derived.serviceValue.toFixed(2)).toLocaleString("en-IN")}</span>
                </div>

                {/* Payment Method */}
                <div className="px-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Payment Method</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-bold text-slate-600">Online</span>
                      </div>
                      <span className="text-xs font-black text-blue-600">₹{Number(derived.onlineTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500" />
                        <span className="text-xs font-bold text-slate-600">Cash (COD)</span>
                      </div>
                      <span className="text-xs font-black text-purple-600">₹{Number(derived.codTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="px-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Deductions</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Platform Commission</span>
                      <span className="text-xs font-black text-orange-600">−₹{Number(derived.commissionTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">GST (18% on Commission)</span>
                      <span className="text-xs font-black text-rose-600">−₹{Number(derived.gstTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                    </div>
                    {derived.tdsTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">TDS</span>
                        <span className="text-xs font-black text-slate-500">−₹{Number(derived.tdsTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                    {derived.tcsTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">TCS</span>
                        <span className="text-xs font-black text-slate-500">−₹{Number(derived.tcsTotal.toFixed(2)).toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Net Earnings */}
                <div className="border-t-2 border-dashed border-slate-200 pt-3 mt-1">
                  <div className="flex items-center justify-between py-3 px-4 bg-emerald-50 rounded-2xl">
                    <span className="text-xs font-black text-emerald-700">Net Earnings</span>
                    <span className="text-lg font-black text-emerald-600">₹{Number(derived.netEarnings.toFixed(2)).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ 3. Settlement Status Pipeline ━━━ */}
          {derived && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h2 className="text-sm font-black text-slate-900 mb-5">Settlement Status</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  { key: "pending_hold", label: "Pending Hold", dot: "bg-amber-500" },
                  { key: "ready_for_payout", label: "Ready for Payout", dot: "bg-blue-500" },
                  { key: "processing", label: "Processing", dot: "bg-indigo-500" },
                  { key: "paid", label: "Paid", dot: "bg-emerald-500" },
                  { key: "cod_pending", label: "COD Pending", dot: "bg-purple-500" },
                  { key: "cod_settled", label: "COD Settled", dot: "bg-cyan-500" },
                  { key: "failed", label: "Failed", dot: "bg-red-500" },
                ].map(({ key, label, dot }) => {
                  const count = derived.statusCounts[key] || 0;
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center p-3 rounded-2xl border text-center ${count > 0 ? (STATUS_BADGE[key] || 'bg-slate-50 text-slate-600 border-slate-100') : 'bg-slate-50/50 text-slate-300 border-slate-50'}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full mb-2 ${count > 0 ? dot : 'bg-slate-200'}`} />
                      <span className="text-[8px] font-black uppercase tracking-widest leading-tight">{label}</span>
                      <span className="text-base font-black mt-1">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ━━━ 30-Day Earnings Trend ━━━ */}
          {derived && derived.trendData.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-sm font-black text-slate-900">30-Day Earnings Trend</h2>
                {derived.topDay.earnings > 0 && (
                  <span className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
                    Peak: ₹{derived.topDay.earnings.toLocaleString("en-IN")} on {derived.topDay.date}
                  </span>
                )}
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={derived.trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#94a3b8" }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Earnings"]}
                    />
                    <Area type="monotone" dataKey="earnings" stroke="#3B82F6" strokeWidth={2} fill="url(#earningsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ━━━ Charts Row: Payment Type Doughnut + Status Pie ━━━ */}
          {derived && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Online vs COD Doughnut */}
              {derived.paymentTypeData.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                  <h2 className="text-sm font-black text-slate-900 mb-4">Online vs Cash</h2>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={derived.paymentTypeData}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {derived.paymentTypeData.map((entry: any, idx: number) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`]}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ fontSize: 10, fontWeight: 800, color: "#475569" }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Settlement Status Pie */}
              {derived.statusPieData.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                  <h2 className="text-sm font-black text-slate-900 mb-4">Settlement Distribution</h2>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={derived.statusPieData}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {derived.statusPieData.map((entry: any, idx: number) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700 }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          iconType="circle"
                          iconSize={8}
                          formatter={(value) => <span style={{ fontSize: 9, fontWeight: 800, color: "#475569", textTransform: "capitalize" }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ━━━ 4. Recent Settlements Table with Filters ━━━ */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-900">Settlement Ledger & History</h2>
              <div className="flex gap-1">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTableFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      tableFilter === tab.id
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking ID</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Commission + GST</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Payout</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hold Ends / Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSettlements.length > 0 ? (
                    filteredSettlements.map((s: any) => (
                      <tr key={s._id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => setSelectedSettlement(s)}>
                        <td className="px-6 py-5">
                          <div>
                            <p className="text-xs font-black text-slate-900">{s.booking_display_id}</p>
                            <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${s.payment_type === 'online' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.payment_type === 'online' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                              {s.payment_type === 'online' ? 'ONLINE' : 'CASH (COD)'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-600 uppercase">{s.payment_type}</td>
                        <td className="px-6 py-5 text-xs font-black text-slate-800">₹{Number(s.gross_amount).toLocaleString("en-IN")}</td>
                        <td className="px-6 py-5 text-xs font-bold text-slate-500">
                          ₹{Number(((s.commission_amount || 0) + (s.gst_on_commission || 0)).toFixed(2)).toLocaleString("en-IN")}
                        </td>
                        <td className="px-6 py-5 text-xs font-black text-emerald-600">
                          {s.payment_type === "online" ? `₹${Number(s.net_payable_amount || 0).toLocaleString("en-IN")}` : `₹${Number((s.gross_amount || 0) - (s.commission_amount || 0) - (s.gst_on_commission || 0) - (s.tds_amount || 0) - (s.tcs_amount || 0)).toLocaleString("en-IN")}`}
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              STATUS_BADGE[s.status] || "bg-slate-50 text-slate-600 border-slate-100"
                            }`}
                          >
                            {s.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-xs font-medium text-slate-500">
                          {s.hold_ends_at
                            ? new Date(s.hold_ends_at).toLocaleDateString()
                            : s.cod_due_by
                            ? new Date(s.cod_due_by).toLocaleDateString()
                            : "N/A"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-bold text-xs">
                        No settlement records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ━━━ Wallet Transaction History ━━━ */}
          {walletTxns.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><WalletIcon size={16} /></div>
                  <h2 className="text-sm font-black text-slate-900">Wallet Transaction History</h2>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">{walletTxns.length} records</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Balance</th>
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Reference</th>
                      <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {walletTxns.slice(0, 30).map((txn: any, idx: number) => {
                      const isCredit = ['recharge', 'refund', 'release', 'credit', 'initial_credit'].includes(txn.type);
                      const TYPE_BADGE: Record<string, string> = {
                        recharge: 'bg-emerald-50 text-emerald-600',
                        deduction: 'bg-red-50 text-red-600',
                        refund: 'bg-blue-50 text-blue-600',
                        hold: 'bg-amber-50 text-amber-600',
                        release: 'bg-sky-50 text-sky-600',
                        credit: 'bg-emerald-50 text-emerald-600',
                        debit: 'bg-red-50 text-red-600',
                        initial_credit: 'bg-indigo-50 text-indigo-600',
                        adjustment: 'bg-purple-50 text-purple-600',
                      };
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${TYPE_BADGE[txn.type] || 'bg-slate-50 text-slate-500'}`}>
                              {txn.type?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs font-bold text-slate-600 max-w-[200px] truncate">{txn.description}</td>
                          <td className={`px-5 py-3 text-xs font-black text-right ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isCredit ? '+' : '−'}₹{Number(txn.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-[10px] font-bold text-slate-400">₹{Number(txn.balanceBefore || 0).toLocaleString('en-IN')}</span>
                            <span className="text-[10px] text-slate-300 mx-1">→</span>
                            <span className="text-xs font-black text-slate-700">₹{Number(txn.balanceAfter || 0).toLocaleString('en-IN')}</span>
                          </td>
                          <td className="px-5 py-3 text-[10px] font-bold text-slate-400 max-w-[120px] truncate" title={txn.referenceId}>{txn.referenceId?.slice(0, 16)}{(txn.referenceId?.length || 0) > 16 ? '…' : ''}</td>
                          <td className="px-5 py-3 text-[10px] font-bold text-slate-400">
                            {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ━━━ Right Sidebar Column (1/3) ━━━ */}
        <div className="space-y-6">

          {/* ━━━ 7. Earnings Insights ━━━ */}
          {derived && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
              <h2 className="text-sm font-black text-slate-900">Earnings Insights</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Zap, label: "Average per Job", value: `₹${Math.round(derived.avgPerJob).toLocaleString("en-IN")}`, color: "text-blue-600 bg-blue-50" },
                  { icon: Award, label: "Highest Settlement", value: `₹${derived.highestSettlement.toLocaleString("en-IN")}`, color: "text-amber-600 bg-amber-50" },
                  { icon: Briefcase, label: "Jobs Completed", value: `${analytics?.totalCompletedOrders || data?.settlementHistory?.length || 0}`, color: "text-violet-600 bg-violet-50" },
                  { icon: Calendar, label: "Next Payout Date", value: derived.nextPayoutDate || '—', color: "text-sky-600 bg-sky-50" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="p-3 rounded-2xl bg-slate-50/50 border border-slate-100">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${color}`}>
                      <Icon size={14} />
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                    <p className="text-base font-black text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ━━━ 5. Bank Information Card ━━━ */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-black text-slate-900">Linked Bank Account</span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    data?.bankStatus === "verified"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      : "bg-slate-50 text-slate-500 border border-slate-200"
                  }`}
                >
                  {data?.bankStatus || "Unconfigured"}
                </span>
              </div>

              {data?.bankStatus === "verified" ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Building size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">{bankForm.bankName}</p>
                    <p className="text-[10px] font-bold text-slate-400">Acc: •••• {bankForm.accountNumber.slice(-4)}</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">IFSC: {bankForm.ifscCode}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs font-bold text-slate-400">Configure bank account to collect payouts</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowBankModal(true)}
              className="w-full mt-6 py-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all text-slate-700"
            >
              Update Bank Details
            </button>
          </div>

          {/* ━━━ 6. COD Widget ━━━ */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-black text-slate-950">Outstanding COD</span>
              <span className="text-lg font-black text-rose-600">₹{(data?.codDues || 0).toLocaleString("en-IN")}</span>
            </div>

            {derived && derived.codDueDays !== null && data?.codDues > 0 && (
              <div className="flex items-center gap-3 p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <div className="p-2 bg-white rounded-xl">
                  <Timer size={16} className="text-rose-600" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Due in</p>
                  <p className="text-lg font-black text-rose-700">{derived.codDueDays} Day{derived.codDueDays !== 1 ? "s" : ""}</p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Remit your outstanding COD cash commission to BharatClap from your wallet credit balance.
            </p>

            <button
              onClick={handleRemitCOD}
              disabled={remitting || !data || data.codDues <= 0}
              className="w-full py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
            >
              {remitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Remit Now"}
            </button>
          </div>

          {/* ━━━ Wallet Credit Card Widget ━━━ */}
          <div className="bg-gradient-to-br from-[#1D2B83] to-indigo-950 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-105 transition-all">
              <WalletIcon className="h-40 w-40" />
            </div>

            <div className="relative z-10">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-200/70 bg-white/10 px-3 py-1 rounded-full">
                Lead Wallet Credit Card
              </span>

              <div className="mt-4 space-y-3">
                <div>
                  <span className="block text-[9px] font-bold text-blue-200/60 uppercase tracking-wider">Balance</span>
                  <span className="text-2xl font-black">₹{balance.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold text-blue-200/60 uppercase tracking-wider">Credit</span>
                  <span className="text-lg font-black">₹{availableCredit.toLocaleString("en-IN")} / ₹{limit.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Lead Packages */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="block text-[9px] font-bold text-blue-200/80 uppercase tracking-wider mb-3">Recharge Plans</span>
                {packagesLoading ? (
                  <div className="text-xs text-blue-200/60 font-medium">Loading...</div>
                ) : leadPackages.length === 0 ? (
                  <div className="text-xs text-blue-200/60 font-medium">No packages available.</div>
                ) : (
                  <div className="space-y-2">
                    {leadPackages.slice(0, 3).map((pkg) => (
                      <div key={pkg._id} className="p-3 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-between hover:bg-white/20 transition-all">
                        <div>
                          <span className="font-black text-xs text-white">{pkg.name}</span>
                          <span className="text-[9px] text-blue-200/80 font-semibold block">
                            {pkg.leads + (pkg.bonusLeads || 0)} Leads • {pkg.validityDays}D
                          </span>
                        </div>
                        <button
                          onClick={() => handlePurchasePackage(pkg)}
                          disabled={purchasingPkgId === pkg._id}
                          className="px-3 py-1.5 bg-white text-indigo-950 hover:bg-blue-50 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                          {purchasingPkgId === pkg._id ? "..." : `₹${pkg.price}`}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Details Modal */}
      <Modal
        title={<span className="text-base font-black text-slate-900">Update Bank Account Details</span>}
        open={showBankModal}
        onCancel={() => setShowBankModal(false)}
        footer={null}
        className="rounded-3xl overflow-hidden"
      >
        <form onSubmit={handleUpdateBank} className="space-y-4 mt-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Holder Name</label>
            <input
              type="text"
              required
              value={bankForm.accountHolderName}
              onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Number</label>
            <input
              type="text"
              required
              value={bankForm.accountNumber}
              onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">IFSC Code</label>
              <input
                type="text"
                required
                value={bankForm.ifscCode}
                onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bank Name</label>
              <input
                type="text"
                required
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition-all"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={updatingBank}
            className="w-full mt-6 py-3.5 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl text-xs font-black uppercase tracking-wider transition-all text-center"
          >
            {updatingBank ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Save Bank Details"}
          </button>
        </form>
      </Modal>
      {/* ━━━ Settlement Timeline Drawer ━━━ */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={() => setSelectedSettlement(null)}>
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Settlement Timeline</h3>
              <button onClick={() => setSelectedSettlement(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-500">Booking</span>
                <span className="font-black text-slate-900">{selectedSettlement.booking_display_id}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-500">Type</span>
                <span className={`font-black uppercase ${selectedSettlement.payment_type === 'cod' ? 'text-purple-600' : 'text-blue-600'}`}>{selectedSettlement.payment_type}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-500">Gross</span>
                <span className="font-black text-slate-900">₹{selectedSettlement.gross_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-500">Net Payable</span>
                <span className="font-black text-emerald-600">₹{selectedSettlement.net_payable_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-bold text-slate-500">Status</span>
                <span className="font-black text-slate-900 uppercase">{selectedSettlement.status?.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <h4 className="text-xs font-black text-slate-900 mb-4 uppercase tracking-wider">Audit Trail</h4>
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
              {(selectedSettlement.audit_trail || []).map((entry: any, idx: number) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                  <p className="text-xs font-black text-slate-900">{entry.action?.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] font-bold text-slate-400">{entry.notes}</p>
                  <p className="text-[9px] font-bold text-slate-300 mt-0.5">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-IN') : '—'}
                  </p>
                </div>
              ))}
              {(!selectedSettlement.audit_trail || selectedSettlement.audit_trail.length === 0) && (
                <p className="text-xs text-slate-400 font-bold">No audit trail recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ━━━ Nearest BharatClap Hub Modal ━━━ */}
      {showHubModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Building2 size={18} /></div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Nearest BharatClap Hub</h3>
                  <p className="text-[10px] font-bold text-slate-400">Cash Deposit Locations</p>
                </div>
              </div>
              <button onClick={() => setShowHubModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {[
                { name: 'BharatClap Central Hub', address: 'Plot 42, Sector 18, Commercial Belt, Cyber City', city: 'NCR / New Delhi', phone: '+91 98765 43210', hours: '09:00 AM - 07:00 PM (Mon-Sat)', map: 'https://maps.google.com/?q=28.49,77.08' },
                { name: 'BharatClap South Regional Hub', address: '128/A, 100 Feet Road, Indiranagar', city: 'Bengaluru', phone: '+91 98765 43211', hours: '09:00 AM - 07:00 PM (Mon-Sat)', map: 'https://maps.google.com/?q=12.97,77.64' },
              ].map(hub => (
                <div key={hub.name} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-black text-slate-900">{hub.name}</p>
                    <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{hub.city}</span>
                  </div>
                  <p className="text-slate-600 font-medium">{hub.address}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 font-bold border-t border-slate-100">
                    <span>📞 {hub.phone}</span>
                    <span>🕒 {hub.hours}</span>
                  </div>
                  <a href={hub.map} target="_blank" rel="noopener noreferrer" className="mt-2 block w-full py-2 text-center bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider">
                    Get Navigation Directions
                  </a>
                </div>
              ))}
            </div>

            <button onClick={() => setShowHubModal(false)} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">
              Remind Me Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
