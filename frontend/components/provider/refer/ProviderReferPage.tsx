"use client";

import { useState, useEffect } from "react";
import {
  Gift,
  Copy,
  CheckCircle2,
  Share2,
  Users,
  Award,
  Clock,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Trophy,
  ExternalLink,
} from "lucide-react";
import { App } from "antd";
import { authFetch } from "@/utils/authFetch";
import { API_URL } from "@/config/api";

interface ReferralItem {
  id: string;
  statusKey: string;
  displayStatus: string;
  reward: string;
  createdAt: string;
}

export default function ProviderReferPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [stats, setStats] = useState({
    totalRewardsEarned: 0,
    successfulReferralsCount: 0,
    pendingReferralsCount: 0,
    myRank: 1,
  });
  const [history, setHistory] = useState<ReferralItem[]>([]);

  useEffect(() => {
    fetchReferralDashboard();
  }, []);

  const fetchReferralDashboard = async () => {
    try {
      setLoading(true);
      const res = await authFetch(`${API_URL}/providers/referral/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setReferralCode(data.referralCode || "BCP-AB12CD");
        setReferralLink(data.referralLink || `https://bharatclap.com/provider/register?ref=${data.referralCode || "BCP-AB12CD"}`);
        setStats(data.stats || {
          totalRewardsEarned: 0,
          successfulReferralsCount: 0,
          pendingReferralsCount: 0,
          myRank: 1,
        });
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load provider referral dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (textToCopy: string, label: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    message.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsapp = () => {
    const text = encodeURIComponent(
      `Join BharatClap as a verified service professional! Use my referral code ${referralCode} at signup. Download app or register: ${referralLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const getStatusBadge = (statusKey: string, text: string) => {
    switch (statusKey) {
      case "rewarded":
        return (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit">
            <CheckCircle2 size={13} /> {text}
          </span>
        );
      case "waiting_first_job":
      case "qualified":
        return (
          <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit">
            <Sparkles size={13} /> {text}
          </span>
        );
      case "kyc_pending":
      case "starter_kit_pending":
        return (
          <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit">
            <Clock size={13} /> {text}
          </span>
        );
      case "registered":
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit">
            <Clock size={13} /> {text}
          </span>
        );
      case "fraud_review":
        return (
          <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-full flex items-center gap-1.5 w-fit">
            <ShieldAlert size={13} /> {text}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full w-fit">
            {text}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] p-6 sm:p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-xs font-bold text-blue-300 mb-3">
                <Gift size={14} /> Provider Referral Program
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Refer Technicians & Earn Rewards</h1>
              <p className="text-slate-300 text-sm mt-1 max-w-xl">
                Share your code <span className="text-amber-400 font-bold">{referralCode}</span> or personal link to earn wallet rewards when your friends complete their first jobs.
              </p>
            </div>

            {/* Quick Share Widget */}
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[300px]">
              <p className="text-xs text-slate-300 font-bold uppercase tracking-wider mb-2">Your Referral Code & Link</p>
              <div className="flex items-center gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-white/10 mb-2">
                <span className="font-mono text-base font-black text-amber-400 tracking-wider flex-1">
                  {loading ? "LOADING..." : referralCode}
                </span>
                <button
                  onClick={() => handleCopyCode(referralCode, "Referral Code")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                >
                  <Copy size={13} /> Copy Code
                </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg border border-white/5 mb-3">
                <span className="text-[10px] text-slate-400 truncate flex-1 font-mono">{referralLink}</span>
                <button
                  onClick={() => handleCopyCode(referralLink, "Referral Link")}
                  className="p-1 text-slate-300 hover:text-white transition"
                  title="Copy Link"
                >
                  <ExternalLink size={14} />
                </button>
              </div>

              <button
                onClick={handleShareWhatsapp}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30"
              >
                <MessageCircle size={15} /> Share via WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Stat Cards + Monthly Leaderboard */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rewards Earned</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">₹{stats.totalRewardsEarned}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Successful Referrals</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.successfulReferralsCount}</h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Referrals</p>
              <h3 className="text-2xl font-black text-slate-900 mt-0.5">{stats.pendingReferralsCount}</h3>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-2xl border border-indigo-800 text-white shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Trophy size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Monthly Leaderboard</p>
              <h3 className="text-2xl font-black text-white mt-0.5">Rank #{stats.myRank}</h3>
            </div>
          </div>
        </div>

        {/* Pipeline Guide */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Sparkles size={18} className="text-blue-600" /> How Referral Qualification Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center mb-3">1</div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Share Code / Link</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Invite qualified technicians with your code {referralCode}.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center mb-3">2</div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">Registration & KYC</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Friend signs up & completes mandatory profile KYC verification.</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center mb-3">3</div>
              <h4 className="text-sm font-bold text-slate-900 mb-1">First Service Completed</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Friend delivers their first successful paid customer booking.</p>
            </div>

            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center mb-3">4</div>
              <h4 className="text-sm font-bold text-emerald-900 mb-1">Instant Wallet Reward</h4>
              <p className="text-xs text-emerald-700 leading-relaxed">System credits your wallet instantly upon service completion!</p>
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Referral History</h3>
              <p className="text-xs text-slate-500 mt-0.5">Track referred technicians and your reward progress</p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading referral history...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">No referrals yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Share code {referralCode} with fellow technicians to start earning rewards when they complete jobs.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3.5 px-6">Referral ID</th>
                    <th className="py-3.5 px-6">Date Joined</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">#{item.id.substring(0, 8)}</td>
                      <td className="py-4 px-6 text-slate-500 text-xs">
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6">{getStatusBadge(item.statusKey, item.displayStatus)}</td>
                      <td className="py-4 px-6 text-right font-bold text-emerald-600">{item.reward}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
  );
}
