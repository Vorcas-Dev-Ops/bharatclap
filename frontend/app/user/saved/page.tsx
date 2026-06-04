"use client";

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import {
  Heart, Search, Star, Clock, MapPin, ShoppingCart,
  Trash2, ArrowRight, Package, SlidersHorizontal
} from "lucide-react";
import Link from "next/link";

const savedServices = [
  {
    id: "1",
    name: "AC Deep Cleaning",
    category: "AC Service",
    image: "https://images.pexels.com/photos/4270366/pexels-photo-4270366.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 799,
    originalPrice: 999,
    rating: 4.8,
    reviews: 2341,
    duration: "2–3 hrs",
    tag: "Bestseller",
    tagColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "2",
    name: "Full Home Deep Cleaning",
    category: "Cleaning",
    image: "https://images.pexels.com/photos/4107120/pexels-photo-4107120.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 1499,
    originalPrice: 1999,
    rating: 4.7,
    reviews: 1870,
    duration: "4–5 hrs",
    tag: "20% Off",
    tagColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "3",
    name: "Electrical Wiring Repair",
    category: "Electrician",
    image: "https://images.pexels.com/photos/1249611/pexels-photo-1249611.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 449,
    originalPrice: 599,
    rating: 4.6,
    reviews: 980,
    duration: "1–2 hrs",
    tag: null,
    tagColor: "",
  },
  {
    id: "4",
    name: "Bathroom Deep Cleaning",
    category: "Cleaning",
    image: "https://images.pexels.com/photos/6195120/pexels-photo-6195120.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 649,
    originalPrice: 799,
    rating: 4.9,
    reviews: 3200,
    duration: "1.5–2 hrs",
    tag: "Top Rated",
    tagColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "5",
    name: "Pest Control (2BHK)",
    category: "Pest Control",
    image: "https://images.pexels.com/photos/5699516/pexels-photo-5699516.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 1299,
    originalPrice: 1599,
    rating: 4.5,
    reviews: 760,
    duration: "2–3 hrs",
    tag: null,
    tagColor: "",
  },
  {
    id: "6",
    name: "Water Purifier Service",
    category: "Appliance Repair",
    image: "https://images.pexels.com/photos/416528/pexels-photo-416528.jpeg?auto=compress&cs=tinysrgb&w=400",
    price: 349,
    originalPrice: 499,
    rating: 4.7,
    reviews: 540,
    duration: "1 hr",
    tag: null,
    tagColor: "",
  },
];

const categories = ["All", "Cleaning", "AC Service", "Electrician", "Pest Control", "Appliance Repair"];

export default function SavedServicesPage() {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("All");
  const [saved,    setSaved]    = useState<Set<string>>(new Set(savedServices.map(s => s.id)));
  const [inCart,   setInCart]   = useState<Set<string>>(new Set());

  const toggleSave = (id: string) => {
    setSaved(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addToCart = (id: string) => {
    setInCart(prev => new Set(prev).add(id));
    setTimeout(() => setInCart(prev => { const n = new Set(prev); n.delete(id); return n; }), 2000);
  };

  const filtered = savedServices.filter(s =>
    saved.has(s.id) &&
    (filter === "All" || s.category === filter) &&
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const discount = (p: number, op: number) => Math.round(((op - p) / op) * 100);

  return (
    <main className="min-h-screen bg-[#F0F4FF]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Heart className="w-7 h-7 text-red-500 fill-red-500" /> Saved Services
            </h1>
            <p className="text-slate-500 mt-1 font-medium">{saved.size} services saved</p>
          </div>
          <Link
            href="/services"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1D2B83] text-white text-xs font-black rounded-xl hover:opacity-90 transition-opacity"
          >
            Explore More <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search saved services..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#1D2B83] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                  filter === c
                    ? "bg-[#1D2B83] text-white shadow-md shadow-blue-900/20"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm py-20 text-center">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black text-base">No saved services found</p>
            <p className="text-slate-300 font-medium text-sm mt-1 mb-6">
              {search ? "Try a different search term" : "Browse services and tap ♡ to save them here"}
            </p>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1D2B83] text-white text-sm font-black rounded-2xl hover:opacity-90 transition-opacity"
            >
              Browse Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={s.image}
                    alt={s.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Discount badge */}
                  <div className="absolute top-3 left-3">
                    <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow">
                      {discount(s.price, s.originalPrice)}% OFF
                    </span>
                  </div>
                  {/* Tag */}
                  {s.tag && (
                    <div className="absolute top-3 right-10">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow ${s.tagColor}`}>{s.tag}</span>
                    </div>
                  )}
                  {/* Heart button */}
                  <button
                    onClick={() => toggleSave(s.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow hover:scale-110 transition-transform"
                  >
                    <Heart className={`w-3.5 h-3.5 ${saved.has(s.id) ? "fill-red-500 text-red-500" : "text-slate-400"}`} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-[10px] font-black text-[#1D2B83] uppercase tracking-widest mb-1">{s.category}</p>
                  <h3 className="text-sm font-black text-slate-900 mb-2 leading-tight">{s.name}</h3>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span className="font-black text-slate-700">{s.rating}</span> ({s.reviews.toLocaleString()})
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> {s.duration}
                    </span>
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-base font-black text-slate-900">₹{s.price}</span>
                      <span className="text-xs text-slate-400 line-through ml-1.5 font-medium">₹{s.originalPrice}</span>
                    </div>
                    <button
                      onClick={() => addToCart(s.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                        inCart.has(s.id)
                          ? "bg-emerald-500 text-white"
                          : "bg-[#1D2B83] text-white hover:opacity-90"
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {inCart.has(s.id) ? "Added!" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
