"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "@/config/api";
import { Star, ThumbsUp, MessageSquare, Filter, ChevronDown, Check, Loader2 } from "lucide-react";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token") || localStorage.getItem("jwt");
      const response = await axios.get(`${API_URL}/reviews/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviews(response.data);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (reviews.length === 0) return { avg: 0, breakdown: [] };
    
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const avg = (sum / reviews.length).toFixed(1);
    
    const breakdown = [5, 4, 3, 2, 1].map(star => {
      const count = reviews.filter(r => r.rating === star).length;
      return {
        stars: star,
        count: count,
        percentage: ((count / reviews.length) * 100).toFixed(0)
      };
    });

    return { avg, breakdown };
  };

  const { avg, breakdown } = calculateStats();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Loading your reviews...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviews & Ratings</h1>
          <p className="text-slate-500 font-medium">Hear what your customers are saying about your work.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
            <Filter className="h-4 w-4" />
            Filter By Rating
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rating Summary */}
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm text-center">
            <h3 className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-4">Average Rating</h3>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-6xl font-black text-slate-900 tracking-tighter">{avg}</span>
              <div className="flex flex-col items-start">
                <div className="flex text-amber-500">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-5 w-5 ${Number(avg) >= s ? 'fill-current' : ''}`} />)}
                </div>
                <span className="text-sm font-bold text-slate-400 mt-1">{reviews.length} Reviews</span>
              </div>
            </div>
            <p className="text-emerald-600 text-sm font-bold bg-emerald-50 py-2 rounded-xl mt-6">
              Top 1% Professional in Gurgaon
            </p>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <h3 className="text-slate-900 text-base font-black mb-6">Rating Breakdown</h3>
            <div className="space-y-4">
              {breakdown.map((item: any) => (
                <div key={item.stars} className="flex items-center gap-4">
                  <div className="flex items-center gap-1 w-8">
                    <span className="text-sm font-bold text-slate-600">{item.stars}</span>
                    <Star className="h-3 w-3 text-amber-500 fill-current" />
                  </div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-bold text-slate-400 w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900">Recent Feedback</h2>
            <button className="flex items-center gap-2 text-sm font-bold text-primary">
              Sort by: Newest
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6">
            {reviews.length > 0 ? (
              reviews.map((review: any) => (
                <div key={review._id} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <img 
                        src={review.user_id?.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${review.user_id?.name || 'User'}`} 
                        alt="" 
                        className="h-14 w-14 rounded-2xl border-2 border-white shadow-sm" 
                      />
                      <div>
                        <h4 className="text-base font-black text-slate-900">{review.user_id?.name || "Customer"}</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${review.rating > i ? 'fill-current' : 'text-slate-200'}`} />
                            ))}
                          </div>
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg uppercase tracking-wider">
                      {review.service_id?.service_name || "General Service"}
                    </span>
                  </div>
                  
                  <div className="relative">
                    <MessageSquare className="absolute -left-2 -top-2 h-10 w-10 text-slate-50 -z-0" />
                    <p className="text-slate-600 font-medium leading-relaxed relative z-10 italic">
                      "{review.comment}"
                    </p>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button className="flex items-center gap-2 text-slate-400 hover:text-primary transition-colors text-xs font-bold">
                        <ThumbsUp className="h-4 w-4" />
                        Helpful
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Check className="h-4 w-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Verified Customer</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-[40px] border border-dashed border-slate-200 text-center">
                <MessageSquare className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold">No reviews yet. Complete bookings to get feedback!</p>
              </div>
            )}
          </div>

          <div className="py-8 text-center">
            <button className="px-8 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm">
              View All Reviews
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
