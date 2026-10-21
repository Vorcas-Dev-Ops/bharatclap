"use client";

import React from "react";
import {
  Pencil as Edit,
  Trash2,
  Eye,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Calendar,
  Clock,
  MapPin,
  Users,
} from "lucide-react";

export interface Banner {
  _id: string;
  id?: string;
  title: string;
  subtitle?: string;
  image?: string;
  image_url: string;
  redirect_type: "category" | "service" | "url" | "none";
  redirect_id?: string;
  redirect_url?: string;
  button_text?: string;
  background_color?: string;
  backgroundColor?: string;
  text_color?: string;
  textColor?: string;
  template_config?: {
    template?: string;
    badge_text?: string | null;
    badge_style?: string | null;
    highlight_text?: string | null;
  };
  audience?: "user" | "provider" | "website" | "both" | "all";
  role?: string;
  placement?: string;
  position: number;
  display_order: number;
  status: "active" | "inactive";
  start_date?: string | Date | null;
  end_date?: string | Date | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface BannerCardProps {
  banner: Banner;
  index: number;
  totalInGroup: number;
  onEdit?: (b: Banner) => void;
  onDelete?: (b: Banner) => void;
  onPreview?: (b: Banner) => void;
  onToggle?: (b: Banner) => void;
  onMoveUp?: (b: Banner) => void;
  onMoveDown?: (b: Banner) => void;
}

const PLACEMENT_LABELS: Record<string, string> = {
  homepage_after_hero: "Homepage: After Hero",
  homepage_after_categories: "Homepage: After Categories",
  homepage_after_services: "Homepage: After Services / Trust",
  homepage_bottom: "Homepage: Bottom",
  services_page: "Services Page",
  provider_dashboard: "Provider Dashboard",
};

const BannerCard: React.FC<BannerCardProps> = ({
  banner,
  index,
  totalInGroup,
  onEdit,
  onDelete,
  onPreview,
  onToggle,
  onMoveUp,
  onMoveDown,
}) => {
  const imageUrl = banner.image_url || banner.image || "";
  const audience = banner.audience || banner.role || "both";
  const placementLabel =
    PLACEMENT_LABELS[banner.placement || "homepage_after_categories"] ||
    banner.placement ||
    "Homepage";

  // Calculate schedule state
  const now = new Date().getTime();
  const startDate = banner.start_date || banner.startDate ? new Date(banner.start_date || banner.startDate!).getTime() : null;
  const endDate = banner.end_date || banner.endDate ? new Date(banner.end_date || banner.endDate!).getTime() : null;

  let scheduleStatus: "active" | "scheduled" | "expired" | "inactive" = banner.status === "inactive" ? "inactive" : "active";
  if (banner.status === "active") {
    if (startDate && now < startDate) {
      scheduleStatus = "scheduled";
    } else if (endDate && now > endDate) {
      scheduleStatus = "expired";
    }
  }

  const formatDate = (dateVal?: string | Date | null) => {
    if (!dateVal) return null;
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return null;
    }
  };

  return (
    <div className="bg-white rounded-[22px] p-4 border border-gray-200/90 hover:border-blue-400 hover:shadow-xl transition-all duration-300 flex flex-col justify-between h-full group">
      <div>
        {/* Banner Graphic Preview Box */}
        <div
          style={{ backgroundColor: banner.background_color || '#1e1b4b' }}
          className="h-44 sm:h-48 rounded-xl overflow-hidden relative shadow-inner flex flex-col justify-between p-4 isolate"
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={banner.title || "Banner"}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out opacity-85"
            />
          ) : (
            <div
              className="absolute inset-0 opacity-80"
              style={{ backgroundColor: banner.background_color || '#5E2FD9' }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10 -z-10" />

          {/* Top Row: Audience badge + Placement Tag */}
          <div className="flex items-center justify-between z-10 w-full gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[9px] font-extrabold uppercase tracking-widest text-white truncate max-w-[170px]">
              {placementLabel}
            </span>

            {/* Quick Enable/Disable Switch */}
            <button
              type="button"
              onClick={() => onToggle?.(banner)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                banner.status === "active" ? "bg-emerald-500" : "bg-gray-500"
              }`}
              title={banner.status === "active" ? "Click to disable" : "Click to enable"}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  banner.status === "active" ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Bottom Row: Title & Action Overlay */}
          <div className="z-10 mt-auto">
            <h3
              style={{ color: banner.text_color || '#FFFFFF' }}
              className="font-extrabold text-base sm:text-lg leading-tight drop-shadow-md line-clamp-2"
            >
              {banner.title || "Untitled Banner"}
            </h3>
            {banner.button_text && (
              <div className="mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white !text-slate-900 font-extrabold text-[10px] uppercase tracking-wider shadow-md">
                  <span className="text-slate-900 font-black">{banner.button_text}</span>
                  <ArrowRight size={11} className="text-slate-900 stroke-[3]" />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Badges Row */}
        <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
          {/* Status Badge */}
          {scheduleStatus === "active" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active (Live)
            </span>
          )}
          {scheduleStatus === "scheduled" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock size={11} className="text-amber-600" />
              Scheduled
            </span>
          )}
          {scheduleStatus === "expired" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200">
              Expired
            </span>
          )}
          {scheduleStatus === "inactive" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
              Disabled
            </span>
          )}

          {/* Audience Badge */}
          <span
            className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
              audience === "website"
                ? "bg-teal-50 text-teal-700 border border-teal-200"
                : audience === "both" || audience === "all"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : audience === "provider"
                ? "bg-purple-50 text-purple-700 border border-purple-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {audience === "website"
              ? "Website"
              : audience === "both" || audience === "all"
              ? "All Platforms"
              : audience === "provider"
              ? "Partner App"
              : "Customer App"}
          </span>

          {/* Color Swatch Badge */}
          {banner.background_color && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-50 border border-gray-200 text-gray-700"
              title={`Background Color: ${banner.background_color}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full border border-black/20"
                style={{ backgroundColor: banner.background_color }}
              />
              <span className="font-mono text-[9px] uppercase">{banner.background_color}</span>
            </span>
          )}

          {/* Template Badge */}
          {banner.template_config?.template && banner.template_config.template !== "split" && (
            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
              {banner.template_config.template.replace(/_/g, " ")}
            </span>
          )}

          {/* Order Badge with Up/Down Controls */}
          <div className="ml-auto flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
            <span className="text-[10px] font-extrabold text-gray-700 mr-1">
              #{banner.position ?? banner.display_order ?? 0}
            </span>
            {onMoveUp && (
              <button
                type="button"
                onClick={() => onMoveUp(banner)}
                disabled={index === 0}
                className="p-1 hover:bg-white rounded text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                title="Move Up"
              >
                <ArrowUp size={12} />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={() => onMoveDown(banner)}
                disabled={index === totalInGroup - 1}
                className="p-1 hover:bg-white rounded text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-colors"
                title="Move Down"
              >
                <ArrowDown size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Info Box: Placement, Dates & Link */}
        <div className="mt-3 p-2.5 bg-gray-50/80 rounded-xl border border-gray-100 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-gray-500">
            <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
              <MapPin size={11} /> Slot:
            </span>
            <span className="font-bold text-gray-800 text-[10px] truncate max-w-[180px]">
              {placementLabel}
            </span>
          </div>

          <div className="flex items-center justify-between text-gray-500">
            <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider">
              Link:
            </span>
            <span
              className="font-medium text-gray-700 truncate max-w-[180px]"
              title={banner.redirect_url || banner.redirect_type}
            >
              {banner.redirect_url || banner.redirect_type || "None"}
            </span>
          </div>

          {(banner.start_date || banner.end_date) && (
            <div className="flex items-center justify-between text-gray-500 pt-1 border-t border-gray-200/50">
              <span className="font-semibold text-gray-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <Calendar size={10} /> Dates:
              </span>
              <span className="font-medium text-gray-700 text-[10px]">
                {formatDate(banner.start_date) || "Now"} → {formatDate(banner.end_date) || "Ongoing"}
              </span>
            </div>
          )}
        </div>

        {/* Subtitle / Description Text */}
        {banner.subtitle && (
          <p className="mt-2.5 text-xs text-gray-500 line-clamp-2 font-medium leading-relaxed">
            {banner.subtitle}
          </p>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onPreview?.(banner)}
          className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
        >
          <Eye size={13} className="text-gray-500 shrink-0" /> Preview
        </button>

        <button
          type="button"
          onClick={() => onEdit?.(banner)}
          className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
        >
          <Edit size={13} className="text-gray-500 shrink-0" /> Edit
        </button>

        <button
          type="button"
          onClick={() => onDelete?.(banner)}
          className="flex items-center justify-center gap-1.5 py-2 px-2 border border-gray-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer"
        >
          <Trash2 size={13} className="shrink-0" /> Delete
        </button>
      </div>
    </div>
  );
};

export default BannerCard;
