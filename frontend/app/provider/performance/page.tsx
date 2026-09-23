"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/config/api";
import {
  Star,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  BarChart3,
  Loader2,
  ThumbsUp,
  Zap,
} from "lucide-react";

interface Analytics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalEarnings: number;
  avgRating: number;
  totalReviews: number;
  completionRate: number;
  responseRate: number;
}

interface Review {
  _id: string;
  rating: number;
  comment?: string;
  customer?: { name?: string };
  createdAt: string;
}

export default function ProviderPerformancePage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [analyticsRes, reviewsRes] = await Promise.all([
          apiClient.get("/providers/dashboard-analytics").catch(() => ({ data: null })),
          apiClient.get("/reviews/my").catch(() => ({ data: [] })),
        ]);

        if (analyticsRes.data) {
          const d = analyticsRes.data;
          setAnalytics({
            totalBookings: d.totalBookings || d.total_bookings || 0,
            completedBookings: d.completedBookings || d.completed_bookings || 0,
            cancelledBookings: d.cancelledBookings || d.cancelled_bookings || 0,
            pendingBookings: d.pendingBookings || d.pending_bookings || 0,
            totalEarnings: d.totalEarnings || d.total_earnings || 0,
            avgRating: d.avgRating || d.avg_rating || 0,
            totalReviews: d.totalReviews || d.total_reviews || 0,
            completionRate: d.completionRate || d.completion_rate || 0,
            responseRate: d.responseRate || d.response_rate || 0,
          });
        }

        const revData = Array.isArray(reviewsRes.data) ? reviewsRes.data : reviewsRes.data?.reviews || [];
        setReviews(revData.slice(0, 10));
      } catch (e) {
        console.error("[Performance] Failed to load data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  const a = analytics || {} as Analytics;
  const rating = a.avgRating || 0;
  const completionRate = a.totalBookings > 0
    ? Math.round((a.completedBookings / a.totalBookings) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          <BarChart3 size={22} className="text-blue-600" />
          Performance
        </h1>
        <p className="text-xs text-gray-500 font-medium">Your ratings, reviews, and job statistics</p>
      </div>

      {/* Rating Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-600/20">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-black">{rating.toFixed(1)}</div>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={16}
                  className={s <= Math.round(rating) ? "fill-yellow-300 text-yellow-300" : "text-white/30"}
                />
              ))}
            </div>
            <div className="text-xs text-blue-100 font-medium mt-1">
              {a.totalReviews} review{a.totalReviews !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-2xl font-black">{completionRate}%</div>
              <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Completion Rate</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="text-2xl font-black">{a.responseRate ? `${a.responseRate}%` : "—"}</div>
              <div className="text-[10px] font-bold text-blue-100 uppercase tracking-wider">Response Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Jobs", value: a.totalBookings, icon: Zap, color: "text-blue-600 bg-blue-50" },
          { label: "Completed", value: a.completedBookings, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50" },
          { label: "Cancelled", value: a.cancelledBookings, icon: XCircle, color: "text-red-600 bg-red-50" },
          { label: "Earnings", value: `₹${(a.totalEarnings || 0).toLocaleString("en-IN")}`, icon: TrendingUp, color: "text-indigo-600 bg-indigo-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
              <stat.icon size={16} />
            </div>
            <div className="text-xl font-black text-gray-900">{stat.value}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Rating Distribution */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 mb-4">Rating Distribution</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews.filter((r) => Math.round(r.rating) === star).length;
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-xs font-bold text-gray-700">{star}</span>
                  <Star size={12} className="fill-yellow-400 text-yellow-400" />
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 mb-4">Recent Reviews</h3>
        {reviews.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <ThumbsUp size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs font-bold">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r._id} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-900">{r.customer?.name || "Customer"}</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={10}
                        className={s <= Math.round(r.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}
                      />
                    ))}
                  </div>
                </div>
                {r.comment && <p className="text-[11px] text-gray-600 leading-relaxed">{r.comment}</p>}
                <p className="text-[9px] text-gray-400 font-medium mt-1">
                  {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
