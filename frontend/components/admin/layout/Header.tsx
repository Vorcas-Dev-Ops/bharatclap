"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Menu, Bell, X, Pencil, Save,
  User2, Mail, Phone, ShieldCheck, Lock, CheckCircle2, AlertCircle, Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from '@/config/api';

interface HeaderProps { onMenuClick: () => void; }

interface UserProfile {
  _id: string; name: string; email: string;
  phone: string; gender?: string; role: string; profile_image?: string; status: string;
}

interface FormState { name: string; email: string; phone: string; gender: string; password: string; }
interface ErrorState { name: string; email: string; phone: string; password: string; }

/* ─── Validation helpers ─── */
const validators: Record<string, (v: string) => string> = {
  name: (v: string) => {
    if (!v.trim()) return "Name is required";
    if (!/^[A-Za-z\s]+$/.test(v)) return "Only letters and spaces allowed";
    if (v.trim().length < 2) return "Name must be at least 2 characters";
    return "";
  },
  email: (v: string) => {
    if (!v.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address";
    return "";
  },
  phone: (v: string) => {
    if (!v.trim()) return "Phone is required";
    if (!/^\d{10}$/.test(v)) return "Phone must be exactly 10 digits";
    return "";
  },
  gender: (_v: string) => "",
  password: (v: string) => {
    if (!v) return "";
    if (v.length < 6) return "Minimum 6 characters";
    if (!/[A-Z]/.test(v)) return "Must include at least 1 uppercase letter";
    if (!/[a-z]/.test(v)) return "Must include at least 1 lowercase letter";
    if (!/[0-9]/.test(v)) return "Must include at least 1 digit";
    if (!/[^A-Za-z0-9]/.test(v)) return "Must include at least 1 symbol";
    return "";
  },
};

/* ─── Compress image to base64 via canvas ─── */
const compressImage = (file: File, maxWidth = 200, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas not supported");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ─── Avatar fallback (initials) ─── */
const AvatarFallback = ({ name }: { name: string }) => {
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-sm">
      {initials}
    </div>
  );
};

/* ─── Inline error tag ─── */
const FieldError = ({ msg }: { msg: string }) =>
  msg ? (
    <motion.p
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="flex items-center gap-1 text-[10px] text-red-500 font-semibold mt-0.5"
    >
      <AlertCircle size={10} /> {msg}
    </motion.p>
  ) : null;

/* ══════════════════════════════════════════ */
const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [imgError, setImgError] = useState(false);

  // profile image preview (local, before save)
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", gender: "", password: "" });
  const [errors, setErrors] = useState<ErrorState>({ name: "", email: "", phone: "", password: "" });
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    name: false, email: false, phone: false, gender: false, password: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /* load user from localStorage */
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed: UserProfile = JSON.parse(stored);
        setUser(parsed);
        setForm({ name: parsed.name, email: parsed.email, phone: parsed.phone || "", gender: parsed.gender || "", password: "" });
      } catch { }
    }
  }, []);

  /* close on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) closeModal();
    };
    if (modalOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditMode(false);
    setSaveSuccess(false);
    resetForm();
  };

  const resetForm = () => {
    if (user) setForm({ name: user.name, email: user.email, phone: user.phone || "", gender: user.gender || "", password: "" });
    setErrors({ name: "", email: "", phone: "", password: "" });
    setTouched({ name: false, email: false, phone: false, gender: false, password: false });
    setPreviewImg(null);
    setImgError(false);
  };

  /* ─── Image pick handler ─── */
  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    try {
      const base64 = await compressImage(file, 300, 0.85);
      setPreviewImg(base64);
      setImgError(false);
    } catch {
      console.error("Image compression failed");
    }
    // reset input so same file can be re-selected
    e.target.value = "";
  };

  /* ─── Validation ─── */
  const validateField = (field: keyof FormState, value: string) => validators[field](value);

  const handleChange = (field: keyof FormState, raw: string) => {
    let value = raw;
    if (field === "phone") value = raw.replace(/\D/g, "").slice(0, 10);
    if (field === "name") value = raw.replace(/[^A-Za-z\s]/g, "");
    setForm((f) => ({ ...f, [field]: value }));
    if (touched[field]) setErrors((e) => ({ ...e, [field]: validateField(field, value) }));
  };

  const handleBlur = (field: keyof FormState) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validateField(field, form[field]) }));
  };

  const validateAll = (): boolean => {
    const newErrors: ErrorState = {
      name: validateField("name", form.name),
      email: validateField("email", form.email),
      phone: validateField("phone", form.phone),
      password: validateField("password", form.password),
    };
    setErrors(newErrors);
    setTouched({ name: true, email: true, phone: true, gender: true, password: true });
    return Object.values(newErrors).every((e) => !e);
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!validateAll()) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const body: Record<string, string> = {
        name: form.name, email: form.email, phone: form.phone, gender: form.gender,
      };
      if (form.password.trim()) body.password = form.password;
      if (previewImg) body.profile_image = previewImg;

      const res = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const updated: UserProfile = await res.json();
        // Keep the previewImg in the saved user if backend didn't echo it back fully
        const merged = { ...updated, profile_image: previewImg ?? updated.profile_image };
        setUser(merged);
        const stored = localStorage.getItem("user");
        const prev = stored ? JSON.parse(stored) : {};
        localStorage.setItem("user", JSON.stringify({ ...prev, ...merged }));
        setEditMode(false);
        setSaveSuccess(true);
        setPreviewImg(null);
        setErrors({ name: "", email: "", phone: "", password: "" });
        setTouched({ name: false, email: false, phone: false, gender: false, password: false });
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Update failed", err);
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = Object.values(errors).some(Boolean);
  const displayImage = previewImg ?? (imgError ? null : (user?.profile_image || null));

  const roleBadge: Record<string, string> = {
    admin: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    provider: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
    customer: "bg-green-50 text-green-700 ring-1 ring-green-200",
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImagePick}
      />

      {/* ── Top Header Bar ── */}
      <header className="h-14 bg-white sticky top-0 z-40 flex items-center justify-between px-8 border-b border-gray-100/50">
        <div className="flex items-center gap-4">
          <button
            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-all lg:hidden"
            onClick={onMenuClick}
          >
            <Menu size={18} />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <button className="relative p-1.5 text-gray-400 hover:text-blue-600 transition-all">
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full border-2 border-white" />
          </button>
          <div className="h-5 w-[1px] bg-gray-100 hidden sm:block" />

          {/* Profile trigger */}
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => setModalOpen(true)}>
            {/* Avatar */}
            <div className="relative w-8 h-8 rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-300 flex-shrink-0">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <AvatarFallback name={user?.name || "Admin"} />
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="text-left hidden sm:block">
              <h4 className="text-[12px] font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition-colors">
                {user?.name || "Loading..."}
              </h4>
              <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                {user?.role || "—"}
              </p>
            </div>
          </div>
        </div>
      </header>

                  {/* ══ PREMIUM PROFILE MODAL ══ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 sm:p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              ref={modalRef}
              className="relative w-full max-w-[480px] bg-white rounded-[32px] shadow-[0_25px_80px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col max-h-[90vh]"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="overflow-y-auto w-full flex-1" style={{ scrollbarWidth: "none" }}>
                
                {/* ── HERO HEADER ── */}
                <div className="relative h-[130px] shrink-0">
                  {/* Background gradient with overflow-hidden for glows */}
                  <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4f46e5]">
                    <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-16 -right-10 w-56 h-56 bg-violet-500/20 rounded-full blur-3xl" />
                    <div className="absolute top-6 left-1/2 w-24 h-24 bg-blue-300/10 rounded-full blur-2xl" />
                    <div className="absolute top-10 right-16 w-16 h-16 bg-purple-400/15 rounded-full blur-xl" />
                    <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px)" }} />
                  </div>

                  {/* Close button */}
                  <button
                    onClick={closeModal}
                    className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-xl border border-white/20 text-white transition-all duration-300 hover:scale-110 z-20"
                  >
                    <X size={16} />
                  </button>

                  {/* Floating avatar */}
                  <div className="absolute -bottom-[36px] left-1/2 -translate-x-1/2 z-30">
                    <div className="relative group">
                      <div className="w-[80px] h-[80px] rounded-[24px] ring-4 ring-white shadow-xl overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-700 cursor-pointer hover:scale-[1.02] transition-transform duration-300 flex items-center justify-center">
                        {displayImage ? (
                          <img src={displayImage} alt={user?.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
                        ) : (
                          <AvatarFallback name={user?.name || "Admin"} />
                        )}
                      </div>
                      {/* Online pulse */}
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-[3px] border-white shadow-sm flex items-center justify-center">
                        <span className="absolute w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      </div>
                      {/* Camera badge */}
                      {editMode && (
                        <button
                          onClick={() => fileInput.current?.click()}
                          className="absolute -top-1 -right-1 w-7 h-7 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow hover:scale-110 transition-transform z-30"
                        >
                          <Camera size={12} className="text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── PROFILE INFORMATION ── */}
                <div className="pt-[48px] pb-5 px-6 text-center">
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{user?.name || "Super Admin"}</h2>
                  <p className="text-[13px] font-bold text-slate-400 mt-0.5">Platform Administrator</p>
                </div>

                {/* ── IMAGE PREVIEW NOTICE ── */}
                <AnimatePresence>
                  {previewImg && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="mx-6 mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3"
                    >
                      <Camera size={14} className="text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-600 font-semibold">New photo selected — save to apply</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── DETAILS SECTION ── */}
                <div className="px-6 pb-5 space-y-3">
                  <PremiumField icon={<User2 size={15} className="text-indigo-400" />} label="Full Name"
                    value={form.name} error={touched.name ? errors.name : ""} editing={editMode}
                    placeholder="Enter full name" onChange={(v) => handleChange("name", v)} onBlur={() => handleBlur("name")} />
                  <PremiumField icon={<Mail size={15} className="text-indigo-400" />} label="Email Address"
                    value={form.email} error={touched.email ? errors.email : ""} editing={editMode}
                    type="email" placeholder="Enter email address"
                    onChange={(v) => handleChange("email", v)} onBlur={() => handleBlur("email")} />
                  
                  {/* Phone + Gender in same row */}
                  <div className="grid grid-cols-2 gap-3">
                    <PremiumField label="Phone Number"
                      value={form.phone} error={touched.phone ? errors.phone : ""} editing={editMode}
                      type="tel" maxLength={10} placeholder="10-digit number"
                      onChange={(v) => handleChange("phone", v)} onBlur={() => handleBlur("phone")} />

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-gray-800">Gender</label>
                      {editMode ? (
                        <select
                          value={form.gender}
                          onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none"
                        >
                          <option value="">Select...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      ) : (
                        <div className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 capitalize">
                          {form.gender || <span className="text-gray-400">—</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Password — edit only */}
                  <AnimatePresence>
                    {editMode && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                      >
                        <PremiumField icon={<Lock size={15} className="text-indigo-400" />} label="New Password"
                          value={form.password} error={touched.password ? errors.password : ""}
                          editing={true} type="password" placeholder="Leave blank to keep current"
                          onChange={(v) => handleChange("password", v)} onBlur={() => handleBlur("password")} />
                        {!errors.password && (
                          <p className="text-[10px] text-slate-400 mt-1.5 ml-1">Min 6 chars · uppercase · lowercase · digit · symbol</p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Save success */}
                  <AnimatePresence>
                    {saveSuccess && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2.5 text-emerald-700 text-sm font-semibold bg-emerald-50 border border-emerald-100 px-4 py-3 rounded-2xl shadow-sm"
                      >
                        <CheckCircle2 size={16} className="flex-shrink-0" />
                        Profile updated successfully!
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── ACTION BUTTONS ── */}
                <div className="px-6 pb-6 pt-1 flex gap-3">
                  {editMode ? (
                    <>
                      <button
                        onClick={() => { setEditMode(false); resetForm(); }}
                        className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all duration-200 hover:scale-[1.02]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || hasErrors}
                        className="flex-1 h-12 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
                        style={{ background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)" }}
                      >
                        <Save size={15} />
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex-1 h-12 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
                        style={{ background: "linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)" }}
                      >
                        <Pencil size={15} />
                        Edit Profile
                      </button>
                      <button
                        onClick={closeModal}
                        className="h-12 px-5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all duration-200 hover:scale-[1.02]"
                      >
                        Close
                      </button>
                    </>
                  )}
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

/* ══ PremiumField — clean label + rounded box field ══ */
interface PremiumFieldProps {
  icon?: React.ReactNode; label: string; value: string; error: string;
  editing: boolean; type?: string; maxLength?: number; placeholder?: string;
  onChange: (v: string) => void; onBlur: () => void;
}
const PremiumField: React.FC<PremiumFieldProps> = ({
  label, value, error, editing, type = "text", maxLength, placeholder, onChange, onBlur,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-gray-800">{label}</label>
    {editing ? (
      <>
        <input
          type={type} value={value} maxLength={maxLength} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          className={`w-full px-4 py-2.5 rounded-xl bg-gray-50 border text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-indigo-100 transition-all ${
            error ? "border-red-400 bg-red-50/30" : "border-gray-200 focus:border-indigo-400"
          }`}
        />
        <AnimatePresence>
          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-[10px] text-red-500 font-semibold"
            >
              <AlertCircle size={9} /> {error}
            </motion.p>
          )}
        </AnimatePresence>
      </>
    ) : (
      <div className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700 truncate">
        {value || <span className="text-gray-400">—</span>}
      </div>
    )}
  </div>
);

export default Header;
