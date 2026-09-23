"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/config/api";
import {
  ShoppingBag,
  Package,
  Loader2,
  Search,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  AlertCircle,
  ChevronRight,
  Box,
  IndianRupee,
} from "lucide-react";

interface StarterKit {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  items?: string[];
  is_mandatory?: boolean;
}

interface Accessory {
  _id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category?: string;
}

interface KitOrder {
  _id: string;
  order_id?: string;
  items?: { name?: string; quantity?: number }[];
  total_amount?: number;
  status?: string;
  createdAt?: string;
}

export default function ProviderShopPage() {
  const [activeTab, setActiveTab] = useState<"kits" | "accessories" | "orders">("kits");
  const [starterKits, setStarterKits] = useState<StarterKit[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [orders, setOrders] = useState<KitOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [kitsRes, accRes, ordersRes] = await Promise.all([
          apiClient.get("/starter-kits").catch(() => ({ data: [] })),
          apiClient.get("/accessories").catch(() => ({ data: [] })),
          apiClient.get("/kit-orders").catch(() => ({ data: [] })),
        ]);
        setStarterKits(Array.isArray(kitsRes.data) ? kitsRes.data : []);
        setAccessories(Array.isArray(accRes.data) ? accRes.data : []);
        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.orders || []);
      } catch (e) {
        console.error("[Shop] Failed to load data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tabs = [
    { key: "kits" as const, label: "Starter Kits", icon: Box },
    { key: "accessories" as const, label: "Accessories", icon: ShoppingBag },
    { key: "orders" as const, label: "My Orders", icon: Package },
  ];

  const orderStatusStyle: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
    "out for delivery": "bg-purple-100 text-purple-700 border-purple-200",
    delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  const filteredKits = starterKits.filter((k) =>
    k.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredAccessories = accessories.filter((a) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag size={22} className="text-blue-600" />
            Shop
          </h1>
          <p className="text-xs text-gray-500 font-medium">Starter kits, accessories, and order history</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all
              ${activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (for kits/accessories) */}
      {activeTab !== "orders" && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab === "kits" ? "starter kits" : "accessories"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/60 backdrop-blur-xl border border-white/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : (
        <>
          {/* Starter Kits */}
          {activeTab === "kits" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKits.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <Box size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No starter kits available</p>
                </div>
              ) : (
                filteredKits.map((kit) => (
                  <div
                    key={kit._id}
                    className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {kit.image && (
                      <div className="h-40 bg-gray-100 overflow-hidden">
                        <img src={kit.image} alt={kit.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className="text-sm font-black text-gray-900">{kit.name}</h3>
                        {kit.is_mandatory && (
                          <span className="text-[8px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 uppercase">
                            Mandatory
                          </span>
                        )}
                      </div>
                      {kit.description && (
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{kit.description}</p>
                      )}
                      {kit.items && kit.items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {kit.items.slice(0, 3).map((item, i) => (
                            <span key={i} className="text-[9px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {item}
                            </span>
                          ))}
                          {kit.items.length > 3 && (
                            <span className="text-[9px] font-medium text-gray-400">+{kit.items.length - 3} more</span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-lg font-black text-gray-900">₹{kit.price.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Accessories */}
          {activeTab === "accessories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccessories.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-400">
                  <ShoppingBag size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No accessories available</p>
                </div>
              ) : (
                filteredAccessories.map((acc) => (
                  <div
                    key={acc._id}
                    className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {acc.image && (
                      <div className="h-40 bg-gray-100 overflow-hidden">
                        <img src={acc.image} alt={acc.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      {acc.category && (
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">{acc.category}</span>
                      )}
                      <h3 className="text-sm font-black text-gray-900">{acc.name}</h3>
                      {acc.description && (
                        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{acc.description}</p>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-lg font-black text-gray-900">₹{acc.price.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Orders */}
          {activeTab === "orders" && (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-bold">No orders yet</p>
                </div>
              ) : (
                orders.map((order) => {
                  const st = (order.status || "pending").toLowerCase();
                  const colorClass = orderStatusStyle[st] || "bg-gray-100 text-gray-700 border-gray-200";

                  return (
                    <div
                      key={order._id}
                      className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-4 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-900">
                          Order #{order.order_id || order._id.slice(-6).toUpperCase()}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                          {order.status}
                        </span>
                      </div>
                      {order.items && order.items.length > 0 && (
                        <p className="text-[11px] text-gray-500">
                          {order.items.map((it) => `${it.name}${it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ""}`).join(", ")}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[11px]">
                        {order.createdAt && (
                          <span className="text-gray-400 font-medium flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                        {order.total_amount != null && (
                          <span className="font-black text-gray-900">₹{order.total_amount.toLocaleString("en-IN")}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
