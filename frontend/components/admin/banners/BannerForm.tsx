"use client";

import React, { useState, useRef, useCallback } from "react";
import Input from "../common/Input";
import Button from "../common/Button";
import {
  CheckCircle2,
  Upload,
  X,
  Image as ImageIcon,
  Calendar,
  Clock,
  Layers,
  Users,
  MapPin,
  Info,
  AlertTriangle,
  Palette,
  Smartphone,
  Globe,
  Sparkles,
  ArrowRight,
  Layout,
  Tag,
  Sliders,
} from "lucide-react";

interface BannerFormProps {
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  existingCount?: number;
}

export const TEMPLATE_OPTIONS = [
  {
    value: "split",
    label: "Split Card",
    badge: "Default",
    description: "Text Left (58%), Image Right (42%). Universal layout across all apps.",
    icon: "🔲",
  },
  {
    value: "full_background",
    label: "Full Background Image",
    badge: "Edge-to-Edge",
    description: "Edge-to-edge photography with readable tinted overlay & text.",
    icon: "🖼️",
  },
  {
    value: "image_left",
    label: "Image Left / Media Hero",
    badge: "Visual First",
    description: "Product/Service image on Left (42%), Text + CTA on Right (58%).",
    icon: "◀️",
  },
  {
    value: "centered_promo",
    label: "Centered Headline & Promo",
    badge: "Callout",
    description: "Centered promotional badge, headline, subtitle, and CTA button.",
    icon: "🎯",
  },
  {
    value: "highlight_deal",
    label: "Price / Deal Highlight",
    badge: "Discount",
    description: "Prominent discount tag (e.g., 'Starting ₹499') with action button.",
    icon: "🏷️",
  },
];

export const PRESET_COLORS = [
  { label: "Brand Purple", hex: "#5E2FD9" },
  { label: "Deep Indigo", hex: "#1D2B83" },
  { label: "Royal Blue", hex: "#2563EB" },
  { label: "Teal", hex: "#0D9488" },
  { label: "Emerald Green", hex: "#059669" },
  { label: "Amber Sunset", hex: "#D97706" },
  { label: "Crimson Red", hex: "#DC2626" },
  { label: "Midnight Slate", hex: "#0F172A" },
];

export const PLACEMENT_OPTIONS = [
  { value: "homepage_top", label: "Customer App — Top Carousel / Header", group: "Customer App" },
  { value: "homepage_after_hero", label: "Website — After Hero Section", group: "Website" },
  { value: "homepage_after_categories", label: "Website — After Categories / Featured Offers", group: "Website" },
  { value: "homepage_after_services", label: "Website — After Services / Trust", group: "Website" },
  { value: "homepage_bottom", label: "Website — Bottom before Footer", group: "Website" },
  { value: "services_page", label: "Services Listing Page", group: "Other Pages" },
  { value: "provider_dashboard", label: "Partner App / Provider Dashboard", group: "Partner App" },
];

// ponytail: image specs derived from actual Flutter app rendering containers
// Customer App: SizedBox height=165, image height=155, split layout 58%/42%, BoxFit.contain
// Partner App: SizedBox height=150, card width=300, text-only (will support images after this change)
const IMAGE_SPECS = {
  recommended: { width: 900, height: 450 },
  aspectRatio: "2:1",
  aspectRatioValue: 2,
  aspectRatioTolerance: 0.3, // allows ~3:2 through ~5:2
  minWidth: 400,
  minHeight: 200,
  maxFileSizeMB: 2,
  maxFileSizeBytes: 2 * 1024 * 1024,
  supportedFormats: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  supportedLabels: "JPG • JPEG • PNG • WEBP",
  recommendedFormat: "WEBP",
};

interface ImageMeta {
  width: number;
  height: number;
  aspectRatio: string;
  fileSizeBytes: number;
  fileSizeLabel: string;
  format: string;
  formatLabel: string;
  errors: string[];
  warnings: string[];
  valid: boolean;
}

function getImageMeta(file: File): Promise<ImageMeta> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Format check
      const format = file.type || "unknown";
      const formatLabel = format.replace("image/", "").toUpperCase();
      if (!IMAGE_SPECS.supportedFormats.includes(format.toLowerCase())) {
        errors.push(`Unsupported format: ${formatLabel}. Use ${IMAGE_SPECS.supportedLabels}.`);
      }

      // File size check
      if (file.size > IMAGE_SPECS.maxFileSizeBytes) {
        errors.push(`File size ${formatBytes(file.size)} exceeds maximum ${IMAGE_SPECS.maxFileSizeMB} MB.`);
      }

      // Minimum dimensions
      if (w < IMAGE_SPECS.minWidth || h < IMAGE_SPECS.minHeight) {
        errors.push(`Dimensions ${w} × ${h} px are below minimum ${IMAGE_SPECS.minWidth} × ${IMAGE_SPECS.minHeight} px.`);
      }

      // Aspect ratio tolerance check
      if (Math.abs(ratio - IMAGE_SPECS.aspectRatioValue) > IMAGE_SPECS.aspectRatioTolerance) {
        warnings.push(`Aspect ratio ${simplifyRatio(w, h)} differs from recommended ${IMAGE_SPECS.aspectRatio}. Image may not display optimally.`);
      }

      // Dimension recommendation
      if (w < IMAGE_SPECS.recommended.width || h < IMAGE_SPECS.recommended.height) {
        warnings.push(`Recommended: ${IMAGE_SPECS.recommended.width} × ${IMAGE_SPECS.recommended.height} px for best quality.`);
      }

      URL.revokeObjectURL(url);
      resolve({
        width: w,
        height: h,
        aspectRatio: simplifyRatio(w, h),
        fileSizeBytes: file.size,
        fileSizeLabel: formatBytes(file.size),
        format,
        formatLabel,
        errors,
        warnings,
        valid: errors.length === 0,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: 0, height: 0, aspectRatio: "?",
        fileSizeBytes: file.size, fileSizeLabel: formatBytes(file.size),
        format: file.type || "unknown", formatLabel: (file.type || "unknown").replace("image/", "").toUpperCase(),
        errors: ["Could not read image dimensions. File may be corrupt."],
        warnings: [], valid: false,
      });
    };
    img.src = url;
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function simplifyRatio(w: number, h: number): string {
  if (!w || !h) return "?";
  const d = gcd(w, h);
  const rw = w / d;
  const rh = h / d;
  // Simplify large ratios for readability
  if (rw > 20 || rh > 20) {
    const ratio = w / h;
    if (Math.abs(ratio - 2) < 0.15) return "2:1";
    if (Math.abs(ratio - 1.5) < 0.15) return "3:2";
    if (Math.abs(ratio - 1.33) < 0.15) return "4:3";
    if (Math.abs(ratio - 1.78) < 0.15) return "16:9";
    return `${ratio.toFixed(1)}:1`;
  }
  return `${rw}:${rh}`;
}

// ponytail: fileToDataUrl without compression — we need original dimensions for validation
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BannerForm: React.FC<BannerFormProps> = ({ initialData, onSubmit, onCancel, existingCount = 0 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatInitialDate = (dateVal?: string | Date) => {
    if (!dateVal) return "";
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().slice(0, 16);
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    subtitle: initialData?.subtitle || "",
    image_url: initialData?.image_url || initialData?.image || "",
    redirect_type: initialData?.redirect_type || "url",
    redirect_url: initialData?.redirect_url || initialData?.link || "",
    button_text: initialData?.button_text || "",
    background_color: initialData?.background_color || initialData?.backgroundColor || "#5E2FD9",
    text_color: initialData?.text_color || initialData?.textColor || "#FFFFFF",
    template: initialData?.template_config?.template || initialData?.templateConfig?.template || "split",
    badge_text: initialData?.template_config?.badge_text || initialData?.templateConfig?.badge_text || "",
    badge_style: initialData?.template_config?.badge_style || initialData?.templateConfig?.badge_style || "pill",
    highlight_text: initialData?.template_config?.highlight_text || initialData?.templateConfig?.highlight_text || "",
    overlay_type: initialData?.template_config?.overlay?.type || initialData?.templateConfig?.overlay?.type || "dark",
    overlay_opacity: initialData?.template_config?.overlay?.opacity ?? initialData?.templateConfig?.overlay?.opacity ?? 0.45,
    position: initialData?.position ?? initialData?.display_order ?? (existingCount + 1),
    status: initialData?.status || "active",
    audience: initialData?.audience || initialData?.role || "both",
    placement: initialData?.placement || "homepage_after_categories",
    start_date: formatInitialDate(initialData?.start_date || initialData?.startDate),
    end_date: formatInitialDate(initialData?.end_date || initialData?.endDate),
  });

  const [imagePreview, setImagePreview] = useState<string>(
    initialData?.image_url || initialData?.image || ""
  );
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [showSpecInfo, setShowSpecInfo] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "website">("mobile");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate before processing
      const meta = await getImageMeta(file);
      setImageMeta(meta);

      // Read the raw data URL for preview
      const dataUrl = await fileToDataUrl(file);
      setImagePreview(dataUrl);
      setFormData((prev) => ({ ...prev, image_url: dataUrl }));
    } catch (err: any) {
      console.error("Failed to process banner image:", err);
      alert("Failed to process the uploaded image. Please try another file.");
    } finally {
      e.target.value = "";
    }
  }, []);

  const handlePositionPreset = (type: "first" | "specific" | "last") => {
    if (type === "first") {
      setFormData((prev) => ({ ...prev, position: 1 }));
    } else if (type === "last") {
      setFormData((prev) => ({ ...prev, position: Math.max(existingCount + 1, 99) }));
    }
  };

  // ponytail: block submission if image has hard errors (not warnings)
  const imageHasErrors = imageMeta !== null && !imageMeta.valid;
  const isEditingWithExistingImage = !!initialData && imagePreview && !imageMeta; // Editing with unchanged image

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagePreview && !formData.image_url) {
      alert("Please upload a banner image or provide an image URL.");
      return;
    }
    if (imageHasErrors) {
      alert("Please fix image validation errors before saving.");
      return;
    }

    const templateConfig = {
      template: formData.template || "split",
      badge_text: formData.badge_text ? formData.badge_text.trim() : null,
      badge_style: formData.badge_style || "pill",
      highlight_text: formData.highlight_text ? formData.highlight_text.trim() : null,
      overlay: formData.template === "full_background" ? {
        type: formData.overlay_type || "dark",
        opacity: Number(formData.overlay_opacity),
      } : { type: "none", opacity: 0 },
    };

    onSubmit({
      title: formData.title,
      subtitle: formData.subtitle || null,
      image_url: imagePreview || formData.image_url,
      redirect_type: formData.redirect_type,
      redirect_url: formData.redirect_url,
      button_text: formData.button_text || null,
      background_color: formData.background_color || "#5E2FD9",
      text_color: formData.text_color || "#FFFFFF",
      template_config: templateConfig,
      placement: formData.placement,
      position: Number(formData.position) || 0,
      status: formData.status,
      audience: formData.audience,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
    });
  };

  return (
    <form className="space-y-5 bg-white p-2" onSubmit={handleSubmit}>
      {/* ── 1. Image Upload Section ───────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Banner Image *
          </label>
          <button
            type="button"
            onClick={() => setShowSpecInfo(!showSpecInfo)}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-[11px] font-bold cursor-pointer transition-colors"
            title="Image Requirements"
          >
            <Info size={13} /> Image Requirements
          </button>
        </div>

        {/* ── Image Requirements Panel ──────────────────────────────── */}
        {showSpecInfo && (
          <div className="mb-3 p-4 bg-blue-50/60 border border-blue-200/60 rounded-2xl">
            <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider mb-3">Banner Image Requirements</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-blue-500 font-bold block">Recommended dimensions</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.recommended.width} × {IMAGE_SPECS.recommended.height} px</span>
              </div>
              <div>
                <span className="text-blue-500 font-bold block">Recommended aspect ratio</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.aspectRatio}</span>
              </div>
              <div>
                <span className="text-blue-500 font-bold block">Minimum dimensions</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.minWidth} × {IMAGE_SPECS.minHeight} px</span>
              </div>
              <div>
                <span className="text-blue-500 font-bold block">Maximum file size</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.maxFileSizeMB} MB</span>
              </div>
              <div>
                <span className="text-blue-500 font-bold block">Supported formats</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.supportedLabels}</span>
              </div>
              <div>
                <span className="text-blue-500 font-bold block">Recommended format</span>
                <span className="text-gray-800 font-extrabold">{IMAGE_SPECS.recommendedFormat}</span>
              </div>
            </div>
            <p className="text-[10px] text-blue-600/70 mt-3 font-medium flex items-start gap-1.5">
              <Info size={11} className="mt-0.5 shrink-0" />
              The image is displayed using <strong>contain</strong> fit. Avoid placing important content near the edges.
            </p>
          </div>
        )}

        {imagePreview ? (
          <div className="space-y-3">
            {/* Image Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-slate-900 group h-44 sm:h-52">
              <img
                src={imagePreview}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-white text-gray-800 text-xs font-bold rounded-xl shadow-lg hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                >
                  <Upload size={14} /> Change Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview("");
                    setImageMeta(null);
                    setFormData((prev) => ({ ...prev, image_url: "" }));
                  }}
                  className="px-3.5 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg hover:bg-red-700 flex items-center gap-2 cursor-pointer"
                >
                  <X size={14} /> Remove
                </button>
              </div>
            </div>

            {/* ── Validation Results ─────────────────────────────────── */}
            {imageMeta && (
              <div className={`p-3.5 rounded-2xl border text-[11px] ${
                imageMeta.valid
                  ? "bg-emerald-50/60 border-emerald-200/60"
                  : "bg-red-50/60 border-red-200/60"
              }`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                  <div>
                    <span className="text-gray-500 font-bold block">Dimensions</span>
                    <span className="text-gray-900 font-extrabold">{imageMeta.width} × {imageMeta.height} px</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold block">Aspect Ratio</span>
                    <span className="text-gray-900 font-extrabold">{imageMeta.aspectRatio}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold block">File Size</span>
                    <span className="text-gray-900 font-extrabold">{imageMeta.fileSizeLabel}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 font-bold block">Format</span>
                    <span className="text-gray-900 font-extrabold">{imageMeta.formatLabel}</span>
                  </div>
                </div>

                {/* Validation checks */}
                <div className="space-y-1">
                  {imageMeta.errors.map((err, i) => (
                    <div key={`err-${i}`} className="flex items-start gap-1.5 text-red-700 font-bold">
                      <X size={12} className="mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                  {imageMeta.warnings.map((warn, i) => (
                    <div key={`warn-${i}`} className="flex items-start gap-1.5 text-amber-700 font-medium">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      <span>{warn}</span>
                    </div>
                  ))}
                  {imageMeta.valid && imageMeta.warnings.length === 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                      <CheckCircle2 size={12} /> All checks passed
                    </div>
                  )}
                  {imageMeta.valid && imageMeta.warnings.length > 0 && (
                    <div className="flex items-center gap-1.5 text-emerald-700 font-bold mt-1">
                      <CheckCircle2 size={12} /> Valid — warnings are recommendations only
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 text-center transition-colors bg-gray-50/50">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <ImageIcon size={22} />
            </div>
            <p className="text-xs font-bold text-gray-700">Upload banner image</p>
            <p className="text-[11px] text-gray-400 mt-1">
              {IMAGE_SPECS.supportedLabels} up to {IMAGE_SPECS.maxFileSizeMB} MB · Recommended: {IMAGE_SPECS.recommended.width}×{IMAGE_SPECS.recommended.height} px
            </p>

            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Upload size={14} /> Upload from Device
              </button>
              <span className="text-xs text-gray-400 font-medium">or</span>
              <input
                type="url"
                placeholder="Paste Image URL"
                value={formData.image_url}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, image_url: e.target.value }));
                  setImagePreview(e.target.value);
                  setImageMeta(null); // Can't validate external URLs client-side
                }}
                className="w-full sm:w-auto flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* ── 2. Content Details ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Banner Title *"
          name="title"
          placeholder="e.g. Summer AC Servicing Fest"
          value={formData.title}
          onChange={handleChange}
          required
        />

        <Input
          label="Button CTA Text"
          name="button_text"
          placeholder="e.g. Book Now, Get 30% Off"
          value={formData.button_text}
          onChange={handleChange}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
          Subtitle / Description
        </label>
        <textarea
          name="subtitle"
          placeholder="e.g. Professional cleaning & servicing starting at ₹499 with 30-day warranty."
          rows={2}
          value={formData.subtitle}
          onChange={handleChange}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-xs text-gray-700 font-medium resize-none"
        />
      </div>

      {/* ── 3. Target Audience & Placement Slot ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users size={13} className="text-blue-600" /> Target Platform / App *
          </label>
          <select
            name="audience"
            value={formData.audience}
            onChange={handleChange}
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white text-xs font-bold text-gray-800"
          >
            <option value="both">All Platforms (Customer App, Partner App & Website)</option>
            <option value="user">Customer App (Mobile)</option>
            <option value="provider">Partner App (Mobile)</option>
            <option value="website">Website (Web Portal)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <MapPin size={13} className="text-blue-600" /> Where Should It Appear? *
          </label>
          <select
            name="placement"
            value={formData.placement}
            onChange={handleChange}
            className="w-full h-11 px-3.5 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white text-xs font-bold text-gray-800"
          >
            {PLACEMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 4. Layout Template & Content Customization ─────────────────── */}
      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layout size={14} className="text-blue-600" /> Layout Template & Content Structure
          </label>
          <span className="text-[10px] text-gray-500 font-medium">Select presentation pattern</span>
        </div>

        {/* Template Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {TEMPLATE_OPTIONS.map((tmpl) => {
            const isSelected = formData.template === tmpl.value;
            return (
              <button
                key={tmpl.value}
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, template: tmpl.value }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? "bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20"
                    : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{tmpl.icon}</span>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                      isSelected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"
                    }`}>
                      {tmpl.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-extrabold text-gray-900 leading-tight">
                    {tmpl.label}
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-1 leading-snug">
                    {tmpl.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Contextual Content Controls */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-gray-200/80">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1 flex items-center gap-1">
              <Tag size={12} className="text-blue-600" /> Promotional Badge / Label
            </label>
            <input
              type="text"
              name="badge_text"
              placeholder="e.g. Limited Offer, Best Value, 4.9★"
              value={formData.badge_text}
              onChange={handleChange}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              Badge Shape & Style
            </label>
            <select
              name="badge_style"
              value={formData.badge_style}
              onChange={handleChange}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
              <option value="pill">Pill (Fully Rounded)</option>
              <option value="rounded">Rounded Rectangle</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1">
              Deal Highlight Tag (Price / Discount)
            </label>
            <input
              type="text"
              name="highlight_text"
              placeholder="e.g. Starting ₹499 or Flat 30% OFF"
              value={formData.highlight_text}
              onChange={handleChange}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-blue-700 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>

          {formData.template === "full_background" && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Background Overlay Tone
                </label>
                <select
                  name="overlay_type"
                  value={formData.overlay_type}
                  onChange={handleChange}
                  className="w-full h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="dark">Dark Tint (High Contrast for White Text)</option>
                  <option value="light">Light Tint (For Dark Text)</option>
                  <option value="gradient">Horizontal Gradient</option>
                  <option value="none">No Overlay</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Overlay Opacity ({Math.round(Number(formData.overlay_opacity) * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  name="overlay_opacity"
                  value={formData.overlay_opacity}
                  onChange={handleChange}
                  className="w-full h-9 cursor-pointer accent-blue-600"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 5. Banner Color & Theme Styling ───────────────────────────── */}
      <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Palette size={14} className="text-indigo-600" /> Banner Color & Styling
          </label>
          <span className="text-[10px] text-gray-500 font-medium">Controls background & text appearance</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Background Color */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
              Banner Background Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="background_color"
                value={formData.background_color}
                onChange={handleChange}
                className="w-10 h-10 p-0.5 rounded-xl border border-gray-200 cursor-pointer bg-white"
                title="Pick Custom Color"
              />
              <input
                type="text"
                name="background_color"
                value={formData.background_color}
                onChange={handleChange}
                placeholder="#5E2FD9"
                maxLength={7}
                className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white font-mono text-xs text-gray-800 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            {/* Preset Color Swatches */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, background_color: c.hex }))}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                    formData.background_color.toLowerCase() === c.hex.toLowerCase()
                      ? "ring-2 ring-offset-1 ring-blue-600 scale-110 border-white"
                      : "border-black/15"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div>
            <label className="block text-[11px] font-bold text-gray-700 mb-1.5">
              Banner Text Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                name="text_color"
                value={formData.text_color}
                onChange={handleChange}
                className="w-10 h-10 p-0.5 rounded-xl border border-gray-200 cursor-pointer bg-white"
                title="Pick Custom Text Color"
              />
              <input
                type="text"
                name="text_color"
                value={formData.text_color}
                onChange={handleChange}
                placeholder="#FFFFFF"
                maxLength={7}
                className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-white font-mono text-xs text-gray-800 uppercase focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            {/* Preset Text Colors */}
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, text_color: "#FFFFFF" }))}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                  formData.text_color.toUpperCase() === "#FFFFFF"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Light Text (#FFF)
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, text_color: "#111827" }))}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                  formData.text_color.toUpperCase() === "#111827"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Dark Text (#111)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Live Interactive Real-Time Banner Preview ──────────────── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Live Banner Preview
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {formData.template.toUpperCase()} TEMPLATE
            </span>
          </div>

          {/* Toggle preview device */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === "mobile"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone size={11} /> Customer & Partner App (Mobile)
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("website")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                previewDevice === "website"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Globe size={11} /> Website
            </button>
          </div>
        </div>

        {/* ── Preview Frame: Mobile Device ────────────────────────────── */}
        {previewDevice === "mobile" ? (
          <div
            style={{
              backgroundColor: formData.background_color || "#5E2FD9",
              backgroundImage: formData.template === "full_background" && imagePreview ? `url(${imagePreview})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            className="rounded-2xl p-4 sm:p-5 relative overflow-hidden transition-all duration-300 min-h-[145px] shadow-lg flex items-center"
          >
            {/* Overlay if full_background */}
            {formData.template === "full_background" && (
              <div
                style={{
                  backgroundColor:
                    formData.overlay_type === "dark"
                      ? `rgba(0,0,0,${formData.overlay_opacity})`
                      : formData.overlay_type === "light"
                      ? `rgba(255,255,255,${formData.overlay_opacity})`
                      : formData.overlay_type === "gradient"
                      ? "transparent"
                      : "transparent",
                  backgroundImage:
                    formData.overlay_type === "gradient"
                      ? `linear-gradient(to right, rgba(0,0,0,${Number(formData.overlay_opacity) + 0.2}), rgba(0,0,0,0.1))`
                      : undefined,
                }}
                className="absolute inset-0 pointer-events-none"
              />
            )}

            {/* Template 1: SPLIT (Default) */}
            {formData.template === "split" && (
              <div className="w-full flex items-center justify-between z-10">
                <div className="flex-1 pr-4 space-y-1.5 max-w-[62%]">
                  {formData.badge_text && (
                    <span
                      style={{ color: formData.text_color }}
                      className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase bg-white/20 border border-white/25 ${
                        formData.badge_style === "rounded" ? "rounded-md" : "rounded-full"
                      }`}
                    >
                      {formData.badge_text}
                    </span>
                  )}
                  <p style={{ color: formData.text_color }} className="text-xs font-semibold opacity-95 truncate">
                    {formData.title || "Banner Tag / Headline"}
                  </p>
                  <h4 style={{ color: formData.text_color }} className="text-sm sm:text-base font-extrabold leading-snug line-clamp-2">
                    {formData.subtitle || "Promotional subtitle text appears here"}
                  </h4>
                  <div className="pt-1">
                    <span style={{ color: formData.text_color }} className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <span>{formData.button_text || "Book now"}</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>

                <div className="w-24 sm:w-28 h-24 sm:h-28 relative flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-3xl bg-white/10 blur-xs" />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Banner" className="w-full h-full object-contain relative z-10 drop-shadow-md" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/50 border border-white/20 rounded-2xl border-dashed">
                      <ImageIcon size={22} /><span className="text-[9px] mt-1 font-semibold">Image</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Template 2: FULL_BACKGROUND */}
            {formData.template === "full_background" && (
              <div className="w-full z-10 space-y-2 py-2">
                {formData.badge_text && (
                  <span
                    style={{ color: formData.text_color }}
                    className={`inline-block px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/30 ${
                      formData.badge_style === "rounded" ? "rounded-md" : "rounded-full"
                    }`}
                  >
                    {formData.badge_text}
                  </span>
                )}
                <h3 style={{ color: formData.text_color }} className="text-lg sm:text-xl font-black drop-shadow-sm leading-tight">
                  {formData.title || "Full Background Banner"}
                </h3>
                <p style={{ color: formData.text_color }} className="text-xs opacity-90 line-clamp-2 max-w-md drop-shadow-xs">
                  {formData.subtitle || "Edge-to-edge photography creates an engaging and cinematic experience."}
                </p>
                {formData.button_text && (
                  <div className="pt-1">
                    <span className="px-3.5 py-1.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md">
                      {formData.button_text} <ArrowRight size={12} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Template 3: IMAGE_LEFT */}
            {formData.template === "image_left" && (
              <div className="w-full flex items-center justify-between z-10 gap-3">
                <div className="w-24 sm:w-28 h-24 sm:h-28 relative flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-3xl bg-white/10 blur-xs" />
                  {imagePreview ? (
                    <img src={imagePreview} alt="Banner" className="w-full h-full object-contain relative z-10 drop-shadow-md" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/50 border border-white/20 rounded-2xl border-dashed">
                      <ImageIcon size={22} /><span className="text-[9px] mt-1 font-semibold">Image</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5 max-w-[62%]">
                  {formData.badge_text && (
                    <span
                      style={{ color: formData.text_color }}
                      className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase bg-white/20 border border-white/25 ${
                        formData.badge_style === "rounded" ? "rounded-md" : "rounded-full"
                      }`}
                    >
                      {formData.badge_text}
                    </span>
                  )}
                  <p style={{ color: formData.text_color }} className="text-xs font-semibold opacity-95 truncate">
                    {formData.title || "Banner Tag / Headline"}
                  </p>
                  <h4 style={{ color: formData.text_color }} className="text-sm sm:text-base font-extrabold leading-snug line-clamp-2">
                    {formData.subtitle || "Promotional subtitle text appears here"}
                  </h4>
                  <div className="pt-1">
                    <span style={{ color: formData.text_color }} className="inline-flex items-center gap-1.5 font-bold text-xs">
                      <span>{formData.button_text || "Explore now"}</span>
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Template 4: CENTERED_PROMO */}
            {formData.template === "centered_promo" && (
              <div className="w-full text-center z-10 space-y-2 py-1 flex flex-col items-center">
                {formData.badge_text && (
                  <span
                    style={{ color: formData.text_color }}
                    className={`inline-block px-3 py-0.5 text-[9px] font-black uppercase tracking-wider bg-white/20 border border-white/30 ${
                      formData.badge_style === "rounded" ? "rounded-md" : "rounded-full"
                    }`}
                  >
                    {formData.badge_text}
                  </span>
                )}
                <h3 style={{ color: formData.text_color }} className="text-base sm:text-lg font-black leading-tight max-w-sm">
                  {formData.title || "Centered Promotional Title"}
                </h3>
                <p style={{ color: formData.text_color }} className="text-xs opacity-90 max-w-sm line-clamp-2">
                  {formData.subtitle || "Prominent central announcement or special announcement for partners and customers."}
                </p>
                {formData.button_text && (
                  <div className="pt-1">
                    <span className="px-4 py-1.5 rounded-xl bg-white text-slate-900 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md">
                      {formData.button_text} <ArrowRight size={12} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Template 5: HIGHLIGHT_DEAL */}
            {formData.template === "highlight_deal" && (
              <div className="w-full flex items-center justify-between z-10 gap-3">
                <div className="flex-1 space-y-1.5 max-w-[62%]">
                  {formData.badge_text && (
                    <span
                      style={{ color: formData.text_color }}
                      className={`inline-block px-2 py-0.5 text-[9px] font-extrabold uppercase bg-white/20 border border-white/25 ${
                        formData.badge_style === "rounded" ? "rounded-md" : "rounded-full"
                      }`}
                    >
                      {formData.badge_text}
                    </span>
                  )}
                  <h4 style={{ color: formData.text_color }} className="text-sm sm:text-base font-black leading-snug line-clamp-2">
                    {formData.title || "Special Deal Offer"}
                  </h4>
                  <p style={{ color: formData.text_color }} className="text-xs opacity-85 line-clamp-2">
                    {formData.subtitle || "Limited time discounted pricing with verified professionals."}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-2 bg-white/15 backdrop-blur-md p-3 rounded-2xl border border-white/20 shrink-0">
                  <div className="text-center">
                    <span className="text-[9px] uppercase tracking-wider block opacity-75" style={{ color: formData.text_color }}>
                      Best Value
                    </span>
                    <span className="text-xs sm:text-sm font-black" style={{ color: formData.text_color }}>
                      {formData.highlight_text || "Starting ₹499"}
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-white text-slate-900 font-extrabold text-[11px] inline-flex items-center gap-1 shadow-sm">
                    {formData.button_text || "Claim"} <ArrowRight size={10} />
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Preview Frame: Website View ────────────────────────────── */
          <div
            style={{
              backgroundColor: formData.background_color || "#1D2B83",
              backgroundImage: formData.template === "full_background" && imagePreview ? `url(${imagePreview})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            className="rounded-2xl p-5 sm:p-7 relative overflow-hidden transition-all duration-300 min-h-[160px] shadow-lg flex items-center"
          >
            {formData.template === "full_background" && (
              <div
                style={{
                  backgroundColor:
                    formData.overlay_type === "dark"
                      ? `rgba(0,0,0,${formData.overlay_opacity})`
                      : formData.overlay_type === "light"
                      ? `rgba(255,255,255,${formData.overlay_opacity})`
                      : "transparent",
                  backgroundImage:
                    formData.overlay_type === "gradient"
                      ? `linear-gradient(to right, rgba(0,0,0,${Number(formData.overlay_opacity) + 0.2}), rgba(0,0,0,0.1))`
                      : undefined,
                }}
                className="absolute inset-0 pointer-events-none"
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center w-full z-10">
              <div className="space-y-2">
                <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/15 border border-white/20 inline-block text-white">
                  {formData.badge_text || "Featured Offer"}
                </span>
                <h3 style={{ color: formData.text_color || "#FFFFFF" }} className="text-lg sm:text-xl font-black leading-tight">
                  {formData.title || "Website Banner Title"}
                </h3>
                <p style={{ color: formData.text_color || "#FFFFFF" }} className="text-xs opacity-85 line-clamp-2">
                  {formData.subtitle || "Website promotional banner description text."}
                </p>
                {formData.highlight_text && (
                  <div className="inline-block px-3 py-1 bg-amber-400 text-slate-900 rounded-lg text-xs font-black shadow-sm">
                    {formData.highlight_text}
                  </div>
                )}
                {formData.button_text && (
                  <div className="pt-1.5">
                    <span className="px-4 py-2 rounded-xl bg-white text-slate-900 font-extrabold text-xs inline-flex items-center gap-1.5 shadow-md">
                      {formData.button_text} <ArrowRight size={12} />
                    </span>
                  </div>
                )}
              </div>

              {formData.template !== "full_background" && (
                <div className="h-28 sm:h-32 rounded-xl overflow-hidden relative border border-white/15 bg-black/25 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Banner" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-white/40 text-center">
                      <ImageIcon size={26} className="mx-auto mb-1" />
                      <span className="text-[10px] font-medium">Website Banner Image</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Position & Order Controls ────────────────────────────── */}
      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
            <Layers size={13} className="text-blue-600" /> Banner Position / Display Order
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePositionPreset("first")}
              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Set First (#1)
            </button>
            <button
              type="button"
              onClick={() => handlePositionPreset("last")}
              className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Set Last (#{Math.max(existingCount + 1, 99)})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            name="position"
            value={formData.position}
            onChange={handleChange}
            required
            className="w-28 h-10 px-3 rounded-xl border border-gray-200 bg-white font-extrabold text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          <span className="text-[11px] text-gray-500 font-medium">
            Lower numbers appear first within the chosen section (e.g. 1 = top priority).
          </span>
        </div>
      </div>

      {/* ── 5. Redirect Destination ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Redirect Type
          </label>
          <select
            name="redirect_type"
            value={formData.redirect_type}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all bg-white text-xs font-bold text-gray-800"
          >
            <option value="url">External / Internal URL</option>
            <option value="category">Category Page</option>
            <option value="service">Service Detail</option>
            <option value="none">None (Non-clickable)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <Input
            label="Redirect URL / Path"
            name="redirect_url"
            placeholder="e.g. /services/ac-repair or https://..."
            value={formData.redirect_url}
            onChange={handleChange}
          />
        </div>
      </div>

      {/* ── 6. Scheduling & Status ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar size={13} className="text-gray-500" /> Start Date (Optional)
          </label>
          <input
            type="datetime-local"
            name="start_date"
            value={formData.start_date}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs bg-white font-medium text-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock size={13} className="text-gray-500" /> End Date (Optional)
          </label>
          <input
            type="datetime-local"
            name="end_date"
            value={formData.end_date}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs bg-white font-medium text-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-xs bg-white font-bold text-gray-800"
          >
            <option value="active">Active (Visible)</option>
            <option value="inactive">Inactive (Disabled)</option>
          </select>
        </div>
      </div>

      {/* ── 7. Action Buttons ───────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          type="submit"
          icon={CheckCircle2}
          disabled={imageHasErrors}
        >
          {initialData ? "Update Banner" : "Create Banner"}
        </Button>
      </div>

      {/* Blocked submission warning */}
      {imageHasErrors && (
        <p className="text-[11px] text-red-600 font-bold text-right -mt-2 flex items-center justify-end gap-1">
          <AlertTriangle size={12} /> Fix image errors above before saving
        </p>
      )}
    </form>
  );
};

export default BannerForm;
