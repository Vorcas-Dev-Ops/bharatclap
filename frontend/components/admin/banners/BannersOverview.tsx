"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Image as ImageIcon,
  Users,
  Briefcase,
  Search,
  Filter,
  ChevronDown,
  Layers,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Globe,
} from "lucide-react";
import BannerCard, { Banner } from "./BannerCard";
import BannerForm, { PLACEMENT_OPTIONS } from "./BannerForm";
import Modal from "../common/Modal";
import ConfirmationModal from "../common/ConfirmationModal";
import axios from "axios";
import { API_URL } from "@/config/api";
import { handleAuthenticationFailure } from "@/utils/auth";

export default function BannersOverview() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);
  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);
  const [defaultAudience, setDefaultAudience] = useState<"user" | "provider" | "website" | "both">("both");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("order_asc");

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/banners/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBanners(res.data || []);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        handleAuthenticationFailure("Admin session expired");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleFormSubmit = async (data: any) => {
    try {
      const token = localStorage.getItem("token");
      const bannerId = editingBanner?._id || editingBanner?.id;
      if (editingBanner && bannerId) {
        await axios.put(`${API_URL}/banners/${bannerId}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/banners`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setIsFormOpen(false);
      setEditingBanner(null);
      fetchBanners();
    } catch (err: any) {
      console.error(err);
      const serverMsg = err.response?.data?.message || err.message || "Please check required fields.";
      alert(`Error saving banner: ${serverMsg}`);
    }
  };

  const handleDelete = async () => {
    if (!bannerToDelete) return;
    try {
      const token = localStorage.getItem("token");
      const id = bannerToDelete._id || bannerToDelete.id;
      await axios.delete(`${API_URL}/banners/${id}?permanent=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBannerToDelete(null);
      fetchBanners();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (banner: Banner) => {
    try {
      const token = localStorage.getItem("token");
      const id = banner._id || banner.id;
      const newStatus = banner.status === "active" ? "inactive" : "active";
      await axios.put(
        `${API_URL}/banners/${id}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBanners();
    } catch (err) {
      console.error(err);
    }
  };

  // Reorder controls: Swap position with neighbor banner and persist to database
  const handleMove = async (banner: Banner, direction: "up" | "down", list: Banner[]) => {
    const currentIndex = list.findIndex((b) => (b._id || b.id) === (banner._id || banner.id));
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const neighbor = list[targetIndex];
    const currentPos = banner.position ?? banner.display_order ?? currentIndex + 1;
    const neighborPos = neighbor.position ?? neighbor.display_order ?? targetIndex + 1;

    // Swap positions
    const newCurrentPos = neighborPos === currentPos ? (direction === "up" ? currentPos - 1 : currentPos + 1) : neighborPos;
    const newNeighborPos = currentPos;

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_URL}/banners/reorder`,
        {
          items: [
            { id: banner._id || banner.id, position: newCurrentPos },
            { id: neighbor._id || neighbor.id, position: newNeighborPos },
          ],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBanners();
    } catch (err) {
      console.error("Failed to reorder banners:", err);
    }
  };

  // Filter & Sort Logic
  const now = new Date().getTime();

  const filteredBanners = banners
    .filter((b) => {
      const matchesSearch =
        b.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.redirect_url?.toLowerCase().includes(searchQuery.toLowerCase());

      const bannerAudience = b.audience || b.role || "both";
      const matchesAudience =
        audienceFilter === "all"
          ? true
          : audienceFilter === "user"
          ? bannerAudience === "user" || bannerAudience === "both" || bannerAudience === "all"
          : audienceFilter === "provider"
          ? bannerAudience === "provider" || bannerAudience === "both" || bannerAudience === "all"
          : audienceFilter === "website"
          ? bannerAudience === "website" || bannerAudience === "both" || bannerAudience === "all"
          : bannerAudience === audienceFilter;

      const matchesPlacement =
        placementFilter === "all" ? true : (b.placement || "homepage_after_categories") === placementFilter;

      // Status filtering with schedule awareness
      const start = b.start_date || b.startDate ? new Date(b.start_date || b.startDate!).getTime() : null;
      const end = b.end_date || b.endDate ? new Date(b.end_date || b.endDate!).getTime() : null;

      let computedStatus = b.status === "inactive" ? "inactive" : "active";
      if (b.status === "active") {
        if (start && now < start) computedStatus = "scheduled";
        else if (end && now > end) computedStatus = "expired";
      }

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === computedStatus;

      return matchesSearch && matchesAudience && matchesPlacement && matchesStatus;
    })
    .sort((a, b) => {
      const posA = a.position ?? a.display_order ?? 0;
      const posB = b.position ?? b.display_order ?? 0;

      if (sortBy === "order_asc") return posA - posB;
      if (sortBy === "order_desc") return posB - posA;
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      return 0;
    });

  // Group counts for summary tabs
  const totalUserCount = banners.filter((b) => (b.audience || b.role) === "user" || (b.audience || b.role) === "both" || (b.audience || b.role) === "all").length;
  const totalProviderCount = banners.filter((b) => (b.audience || b.role) === "provider" || (b.audience || b.role) === "both" || (b.audience || b.role) === "all").length;
  const totalWebsiteCount = banners.filter((b) => (b.audience || b.role) === "website" || (b.audience || b.role) === "both" || (b.audience || b.role) === "all").length;

  return (
    <div className="space-y-8 pb-16">
      {/* ── Top Header Section ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Banners Management</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Create, schedule, order, and position promotional banners dynamically across the app and website.
          </p>
        </div>

        <div className="relative isolate">
          <button
            type="button"
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-3 rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={16} /> Create Banner{" "}
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${isCreateMenuOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  setEditingBanner(null);
                  setDefaultAudience("both");
                  setIsFormOpen(true);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-blue-50 text-xs font-bold text-gray-700 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                  <Layers size={14} />
                </div>
                <div>
                  <div className="font-bold">Add Banner — All Platforms</div>
                  <div className="text-[10px] text-gray-400 font-normal">Customer App, Partner App & Website</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  setEditingBanner(null);
                  setDefaultAudience("user");
                  setIsFormOpen(true);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-indigo-50 text-xs font-bold text-gray-700 hover:text-indigo-600 flex items-center gap-2.5 transition-colors mt-1 cursor-pointer"
              >
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Users size={14} />
                </div>
                <div>
                  <div className="font-bold">Add Customer App Banner</div>
                  <div className="text-[10px] text-gray-400 font-normal">Customer mobile app homepage</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  setEditingBanner(null);
                  setDefaultAudience("provider");
                  setIsFormOpen(true);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-purple-50 text-xs font-bold text-gray-700 hover:text-purple-600 flex items-center gap-2.5 transition-colors mt-1 cursor-pointer"
              >
                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                  <Briefcase size={14} />
                </div>
                <div>
                  <div className="font-bold">Add Partner App Banner</div>
                  <div className="text-[10px] text-gray-400 font-normal">Partner mobile app dashboard</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCreateMenuOpen(false);
                  setEditingBanner(null);
                  setDefaultAudience("website");
                  setIsFormOpen(true);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-teal-50 text-xs font-bold text-gray-700 hover:text-teal-600 flex items-center gap-2.5 transition-colors mt-1 cursor-pointer"
              >
                <div className="p-1.5 bg-teal-100 text-teal-600 rounded-lg">
                  <Globe size={14} />
                </div>
                <div>
                  <div className="font-bold">Add Website Banner</div>
                  <div className="text-[10px] text-gray-400 font-normal">Website landing page & promotions</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Audience Summary Tabs ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAudienceFilter("all")}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
            audienceFilter === "all"
              ? "border-2 border-blue-600 text-blue-600 bg-blue-50/50 shadow-sm"
              : "border border-gray-200 text-gray-700 bg-white hover:border-gray-300"
          }`}
        >
          <Layers size={16} />
          <span>All Platforms</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-black">
            {banners.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAudienceFilter("user")}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
            audienceFilter === "user"
              ? "border-2 border-indigo-600 text-indigo-600 bg-indigo-50/50 shadow-sm"
              : "border border-gray-200 text-gray-700 bg-white hover:border-gray-300"
          }`}
        >
          <Users size={16} />
          <span>Customer App</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">
            {totalUserCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAudienceFilter("provider")}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
            audienceFilter === "provider"
              ? "border-2 border-purple-600 text-purple-600 bg-purple-50/50 shadow-sm"
              : "border border-gray-200 text-gray-700 bg-white hover:border-gray-300"
          }`}
        >
          <Briefcase size={16} />
          <span>Partner App</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-black">
            {totalProviderCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setAudienceFilter("website")}
          className={`px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
            audienceFilter === "website"
              ? "border-2 border-teal-600 text-teal-600 bg-teal-50/50 shadow-sm"
              : "border border-gray-200 text-gray-700 bg-white hover:border-gray-300"
          }`}
        >
          <Globe size={16} />
          <span>Website</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-black">
            {totalWebsiteCount}
          </span>
        </button>
      </div>

      {/* ── Search and Filter Controls ─────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, subtitle, or link..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-blue-500 font-medium text-gray-800 bg-white"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Placement Filter */}
          <div className="flex flex-col min-w-[160px]">
            <select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Placements / Slots</option>
              {PLACEMENT_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col min-w-[120px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active (Live)</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex flex-col min-w-[140px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="order_asc">Display Order: Low to High</option>
              <option value="order_desc">Display Order: High to Low</option>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setAudienceFilter("all");
              setPlacementFilter("all");
              setStatusFilter("all");
              setSortBy("order_asc");
            }}
            className="px-3 py-2 rounded-xl border border-gray-200 font-bold text-xs text-gray-600 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Banners Grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
          <p className="text-xs font-bold">Loading banners...</p>
        </div>
      ) : filteredBanners.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBanners.map((banner, idx) => (
            <BannerCard
              key={banner._id || banner.id || idx}
              banner={banner}
              index={idx}
              totalInGroup={filteredBanners.length}
              onEdit={(b) => {
                setEditingBanner(b);
                setIsFormOpen(true);
              }}
              onDelete={(b) => setBannerToDelete(b)}
              onPreview={(b) => setPreviewBanner(b)}
              onToggle={(b) => handleToggle(b)}
              onMoveUp={(b) => handleMove(b, "up", filteredBanners)}
              onMoveDown={(b) => handleMove(b, "down", filteredBanners)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 p-8 shadow-xs">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={28} />
          </div>
          <h3 className="text-base font-extrabold text-gray-900">No banners found</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            {banners.length === 0
              ? "You haven't created any banners yet. Click '+ Create Banner' to add your first promotional banner."
              : "No banners matched your selected filters or search query."}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingBanner(null);
              setDefaultAudience("both");
              setIsFormOpen(true);
            }}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Plus size={14} /> Create Your First Banner
          </button>
        </div>
      )}

      {/* ── Add / Edit Form Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingBanner ? "Edit Promotional Banner" : "Create Promotional Banner"}
      >
        <BannerForm
          key={editingBanner ? editingBanner._id || editingBanner.id : `new-${defaultAudience}`}
          initialData={editingBanner || { audience: defaultAudience, role: defaultAudience }}
          existingCount={banners.length}
          onSubmit={handleFormSubmit}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      {/* ── Live Preview Modal ─────────────────────────────────────────── */}
      {previewBanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl overflow-hidden relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
                  Live Preview • {previewBanner.placement || "homepage_after_categories"}
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 mt-1.5">{previewBanner.title || "Untitled"}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Simulated Live Render Container */}
            <div className="relative w-full h-[300px] sm:h-[380px] rounded-[2.5rem] overflow-hidden bg-[#1D2B83] shadow-2xl p-6 sm:p-12 text-white flex items-center justify-between isolate">
              {previewBanner.image_url || previewBanner.image ? (
                <img
                  src={previewBanner.image_url || previewBanner.image}
                  alt={previewBanner.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-80"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent -z-10" />

              <div className="max-w-lg space-y-4 z-10">
                <div className="flex items-center gap-2 bg-white/10 w-fit px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-md">
                  <ShieldCheck className="h-4 w-4 text-indigo-200" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-100">
                    Featured Offer
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight drop-shadow-md">
                  {previewBanner.title}
                </h2>

                {previewBanner.subtitle && (
                  <p className="text-xs sm:text-base text-indigo-100/90 leading-relaxed font-medium">
                    {previewBanner.subtitle}
                  </p>
                )}

                {previewBanner.button_text && (
                  <div className="pt-2">
                    <span className="bg-white text-[#1D2B83] text-xs sm:text-sm font-extrabold uppercase tracking-widest px-7 py-3.5 rounded-xl shadow-lg inline-flex items-center gap-2">
                      {previewBanner.button_text} <ArrowRight size={14} />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewBanner(null)}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ──────────────────────────────────── */}
      <ConfirmationModal
        isOpen={!!bannerToDelete}
        onClose={() => setBannerToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Banner"
        message="Are you sure you want to permanently delete this banner? It will be removed from all assigned pages and placements."
        confirmLabel="Delete Banner"
        variant="danger"
      />
    </div>
  );
}
