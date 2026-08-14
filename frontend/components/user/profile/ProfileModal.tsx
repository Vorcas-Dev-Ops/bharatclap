"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Edit3, Save, User, Mail, Phone, Lock, Camera, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { API_URL } from "@/config/api";
import { message } from "antd";

import { validateName, validateEmail, validatePhone, validatePassword } from "@/utils/validation";
import PhoneChangeModal from "@/components/common/PhoneChangeModal";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdate: (updatedUser: any) => void;
}

/* ─── Compress image to base64 via canvas ─── */
const compressImage = (file: File, maxWidth = 300, quality = 0.85): Promise<string> =>
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

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [requireEmailOtp, setRequireEmailOtp] = useState(false);
  const [requirePhoneOtp, setRequirePhoneOtp] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [tempData, setTempData] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", gender: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const fileInput = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchFreshUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const freshUser = await res.json();
          onUpdate(freshUser); // Sync back to parent/localStorage
          setForm({ 
            name: freshUser.name || "", 
            email: freshUser.email || "", 
            phone: freshUser.phone || "", 
            gender: freshUser.gender || "", 
            password: "" 
          });
        }
      } catch (e) {
        console.error("Failed to refresh profile", e);
      }
    };

    if (isOpen && user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        gender: user.gender || "",
        password: ""
      });
      setFieldErrors({});
      setIsEditing(false);
      setShowOtp(false);
      setEmailOtp("");
      setPhoneOtp("");
      setRequireEmailOtp(false);
      setRequirePhoneOtp(false);
      setSaveSuccess(false);
      fetchFreshUser();
    }
  }, [isOpen]);

  const handleCancel = () => {
    setIsEditing(false);
    setFieldErrors({});
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      gender: user?.gender || "",
      password: ""
    });
    setPreviewImg(null);
    setShowOtp(false);
    setEmailOtp("");
    setPhoneOtp("");
    setRequireEmailOtp(false);
    setRequirePhoneOtp(false);
  };

  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Step 1: Local format validation
    const newErrors: Record<string, string> = {};

    const nameErr = validateName(form.name);
    if (nameErr) newErrors.name = nameErr;

    const emailErr = validateEmail(form.email);
    if (emailErr) newErrors.email = emailErr;

    if (form.phone) {
      const phoneErr = validatePhone(form.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }

    if (form.password && form.password.trim().length > 0) {
      const passErr = validatePassword(form.password);
      if (passErr) newErrors.password = passErr;
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});

    // Step 2: Detect what changed
    const isPhoneChanged = !!(form.phone && form.phone.trim() !== (user?.phone || ""));
    const isEmailChanged = !!(form.email && form.email.trim() !== (user?.email || ""));
    const isPasswordChanged = !!(form.password && form.password.trim().length > 0);

    // Step 3: Pre-check uniqueness BEFORE sending any OTP
    if (isEmailChanged || isPhoneChanged) {
      setLoading(true);
      try {
        const checkBody: Record<string, string> = {};
        if (isEmailChanged) checkBody.email = form.email.trim();
        if (isPhoneChanged) checkBody.phone = form.phone.trim();

        const checkRes = await fetch(`${API_URL}/users/check-availability`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(checkBody),
        });

        if (!checkRes.ok) {
          const data = await checkRes.json();
          if (data.errors) {
            // Show all duplicate errors inline — do not proceed to OTP
            setFieldErrors((e) => ({ ...e, ...data.errors }));
            setLoading(false);
            return;
          }
        }
      } catch {
        messageApi.error("Failed to check availability. Please try again.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    // Step 4: All clear — send OTPs only if email/phone/password changed
    if (isPhoneChanged || isEmailChanged || isPasswordChanged) {
      setTempData(form);
      setEmailOtp("");
      setPhoneOtp("");

      const reqEmail = isEmailChanged || isPasswordChanged;
      const reqPhone = isPhoneChanged;

      setRequireEmailOtp(reqEmail);
      setRequirePhoneOtp(reqPhone);

      let ok = true;
      if (reqEmail) {
        const targetEmail = isEmailChanged ? form.email.trim() : user.email;
        const sent = await sendOtp(targetEmail, true);
        if (!sent) ok = false;
      }
      if (reqPhone && ok) {
        const sent = await sendOtp(form.phone.trim(), false);
        if (!sent) ok = false;
      }

      if (ok) {
        setShowOtp(true);
      }
      return;
    }

    await performUpdate(form, token);
  };

  const sendOtp = async (targetIdentifier?: string, useEmail?: boolean): Promise<boolean> => {
    setLoading(true);
    const identifier = targetIdentifier || user.email;
    const isEmail = useEmail !== undefined ? useEmail : true;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/users/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ identifier, useEmail: isEmail, mode: "update" }),
      });
      if (res.ok) {
        messageApi.success(`OTP sent to your ${isEmail ? "email (" + identifier + ")" : "phone number (" + identifier + ")"}`);
        return true;
      } else {
        const d = await res.json();
        const msg = d.message || "Failed to send OTP";
        if (msg.toLowerCase().includes("phone")) {
          setFieldErrors((e) => ({ ...e, phone: msg }));
        } else if (msg.toLowerCase().includes("email")) {
          setFieldErrors((e) => ({ ...e, email: msg }));
        } else {
          messageApi.error(msg);
        }
        return false;
      }
    } catch {
      messageApi.error("Failed to send OTP");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (requireEmailOtp && (!emailOtp || emailOtp.length !== 6)) {
      messageApi.error("Please enter a valid 6-digit Email OTP");
      return;
    }
    if (requirePhoneOtp && (!phoneOtp || phoneOtp.length !== 6)) {
      messageApi.error("Please enter a valid 6-digit Phone OTP");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token || !tempData) return;

    await performUpdate({
      ...tempData,
      emailOtp,
      phoneOtp,
      otp: emailOtp || phoneOtp
    }, token);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    try {
      const base64 = await compressImage(file);
      setPreviewImg(base64);
    } catch {
      messageApi.error("Failed to process image");
    }
    e.target.value = "";
  };

  const performUpdate = async (values: any, token: string) => {
    setLoading(true);
    try {
      // Build sanitized payload without sending empty string fields like password: ""
      const body: any = {};
      if (values.name?.trim()) body.name = values.name.trim();
      if (values.email?.trim()) body.email = values.email.trim();
      if (values.phone !== undefined) body.phone = values.phone.trim();
      if (values.gender !== undefined) body.gender = values.gender;
      if (values.password && values.password.trim() !== "") {
        body.password = values.password.trim();
      }
      if (values.emailOtp) body.emailOtp = values.emailOtp;
      if (values.phoneOtp) body.phoneOtp = values.phoneOtp;
      if (values.otp) body.otp = values.otp;
      if (previewImg) body.profile_image = previewImg;
      if (previewImg) body.profile_image = previewImg;

      const res = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        messageApi.success("Profile updated!");
        onUpdate(data);
        setSaveSuccess(true);
        setIsEditing(false);
        setShowOtp(false);
        setTempData(null);
        setEmailOtp("");
        setPhoneOtp("");
        setPreviewImg(null);
        setForm((f) => ({ ...f, password: "" }));
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          const backendFieldErrors: Record<string, string> = {};
          data.errors.forEach((err: any) => {
            if (err.path) backendFieldErrors[err.path] = err.message;
          });
          setFieldErrors(backendFieldErrors);
        } else {
          messageApi.error(data.message || "Update failed");
        }
      }
    } catch {
      messageApi.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name || "User";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          {contextHolder}

          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Responsive Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative w-full max-w-[460px] max-h-[90vh] bg-white rounded-2xl sm:rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.22)] z-10 flex flex-col overflow-hidden my-auto"
          >
            {/* ── COMPACT HERO HEADER ── */}
            <div className="relative h-[110px] sm:h-[120px] shrink-0">
              {/* Hidden file input */}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
              />

              {/* Gradient Hero Background */}
              <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#3730a3] to-[#6366f1]">
                <div className="absolute -top-10 -left-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-10 -right-6 w-40 h-40 bg-violet-400/20 rounded-full blur-2xl" />
                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 28px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 28px)",
                  }}
                />
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                aria-label="Close modal"
                className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/30 border border-white/20 text-white transition-all hover:scale-110 z-20 cursor-pointer"
              >
                <X size={15} />
              </button>

              {/* Avatar — centered, overlapping hero */}
              <div className="absolute -bottom-[42px] sm:-bottom-[46px] left-1/2 -translate-x-1/2 z-30">
                <div className="relative group">
                  <div className="absolute inset-0 rounded-full bg-indigo-400/30 blur-xl scale-110" />
                  <div
                    onClick={() => isEditing && fileInput.current?.click()}
                    className={`relative w-[90px] h-[90px] sm:w-[100px] sm:h-[100px] rounded-full ring-4 ring-white shadow-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center transition-all duration-300 ${
                      isEditing ? "cursor-pointer hover:scale-[1.04]" : ""
                    }`}
                  >
                    {previewImg || user?.profile_image ? (
                      <img
                        src={previewImg || user.profile_image}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-black text-xl sm:text-2xl">{initials}</span>
                    )}

                    {/* Camera overlay in edit mode */}
                    {isEditing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="text-white w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                    )}
                  </div>
                  {!isEditing && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 sm:w-5 sm:h-5 bg-emerald-500 border-[3px] border-white rounded-full shadow-md" />
                  )}
                </div>
              </div>
            </div>

            {/* ── SCROLLABLE BODY ── */}
            <div className="pt-[52px] sm:pt-[58px] px-4 sm:px-6 pb-5 sm:pb-6 overflow-y-auto flex-1 custom-scrollbar">
              {/* Name & Role — hidden when validation errors come */}
              {Object.keys(fieldErrors).length === 0 && (
                <div className="text-center mb-4 sm:mb-5">
                  <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                    {displayName}
                  </h2>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5 capitalize">
                    {user?.role || "Customer"} &bull; <span className="text-emerald-500">Active</span>
                  </p>
                </div>
              )}

              {/* Success Banner */}
              <AnimatePresence>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 mb-4 text-xs sm:text-sm font-semibold"
                  >
                    <CheckCircle2 size={16} className="shrink-0" /> Profile updated successfully!
                  </motion.div>
                )}
              </AnimatePresence>

              {!showOtp ? (
                <>
                  {/* Fields Container */}
                  <div className="space-y-3">
                    <ProfileField
                      icon={<User size={13} />}
                      label="Full Name"
                      value={form.name}
                      editing={isEditing}
                      error={fieldErrors.name}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, name: v }));
                        if (fieldErrors.name) setFieldErrors((e) => ({ ...e, name: "" }));
                      }}
                    />

                    <ProfileField
                      icon={<Mail size={13} />}
                      label="Email Address"
                      value={form.email}
                      editing={isEditing}
                      type="email"
                      error={fieldErrors.email}
                      onChange={(v) => {
                        setForm((f) => ({ ...f, email: v }));
                        if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: "" }));
                      }}
                    />

                    {/* Responsive Phone & Gender layout (1 col on mobile, 2 col on sm+) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <ProfileField
                          icon={<Phone size={13} />}
                          label="Phone Number"
                          value={form.phone}
                          editing={isEditing}
                          maxLength={10}
                          placeholder="10-digit number"
                          error={fieldErrors.phone}
                          onChange={(v) => {
                            setForm((f) => ({ ...f, phone: v.replace(/\D/g, "").slice(0, 10) }));
                            if (fieldErrors.phone) setFieldErrors((e) => ({ ...e, phone: "" }));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setIsPhoneModalOpen(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors mt-1 block"
                        >
                          Change via OTP &rarr;
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs sm:text-sm font-semibold text-gray-800">
                          Gender
                        </label>
                        {isEditing ? (
                          <select
                            value={form.gender?.toLowerCase() || ""}
                            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                            className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all appearance-none cursor-pointer"
                          >
                            <option value="">Select...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        ) : (
                          <div className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-700 capitalize truncate">
                            {form.gender ? form.gender.charAt(0).toUpperCase() + form.gender.slice(1) : <span className="text-gray-400">—</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Password Field (Edit mode only) */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <ProfileField
                            icon={<Lock size={13} />}
                            label="New Password (optional)"
                            value={form.password}
                            editing={true}
                            type="password"
                            placeholder="Leave blank to keep current"
                            error={fieldErrors.password}
                            onChange={(v) => {
                              setForm((f) => ({ ...f, password: v }));
                              if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: "" }));
                            }}
                          />
                          <p className="text-[10px] sm:text-xs text-slate-400 mt-1 ml-1">
                            Min 8 chars with uppercase, lowercase, number & symbol
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2.5 mt-5">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleCancel}
                          className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all active:scale-[0.98] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={loading}
                          className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-indigo-500/25 disabled:opacity-60 cursor-pointer"
                          style={{ background: "linear-gradient(135deg,#4f46e5,#2563eb)" }}
                        >
                          <Save size={14} />
                          {loading ? "Saving..." : "Save Changes"}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-indigo-500/25 cursor-pointer"
                        style={{ background: "linear-gradient(135deg,#4f46e5,#2563eb)" }}
                      >
                        <Edit3 size={14} /> Edit Profile
                      </button>
                    )}
                  </div>
                </>
              ) : (
                /* ── OTP SCREEN ── */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4 py-2"
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" />
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm sm:text-base font-black text-slate-800">
                      {requireEmailOtp && requirePhoneOtp
                        ? "Dual OTP Verification"
                        : requireEmailOtp
                        ? "Verify Email Address"
                        : "Verify Phone Number"}
                    </h3>
                    <p className="text-xs font-medium text-slate-400 mt-1">
                      {requireEmailOtp && requirePhoneOtp
                        ? "Please enter the OTP codes sent to both your new email and phone number."
                        : "Please enter the 6-digit verification code to complete your profile update."}
                    </p>
                  </div>

                  {/* Email OTP Section */}
                  {requireEmailOtp && (
                    <div className="text-left space-y-1 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100/60">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Email Verification Code
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Sent to: <span className="font-bold text-indigo-600">{tempData?.email || user?.email}</span>
                      </p>
                      <input
                        maxLength={6}
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit Email OTP"
                        className="w-full h-10 text-center text-lg sm:text-xl font-bold tracking-[0.25em] rounded-xl border border-slate-200 focus:border-indigo-400 outline-none bg-white transition-all mt-1"
                      />
                    </div>
                  )}

                  {/* Phone OTP Section */}
                  {requirePhoneOtp && (
                    <div className="text-left space-y-1 bg-blue-50/40 p-3 rounded-2xl border border-blue-100/60">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        Phone Verification Code
                      </label>
                      <p className="text-[10px] text-slate-400">
                        Sent to: <span className="font-bold text-blue-600">{tempData?.phone}</span>
                      </p>
                      <input
                        maxLength={6}
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit Phone OTP"
                        className="w-full h-10 text-center text-lg sm:text-xl font-bold tracking-[0.25em] rounded-xl border border-slate-200 focus:border-blue-400 outline-none bg-white transition-all mt-1"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setShowOtp(false)}
                      className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleOtpVerify}
                      disabled={loading}
                      className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-60 cursor-pointer"
                      style={{ background: "linear-gradient(135deg,#4f46e5,#2563eb)" }}
                    >
                      {loading ? "Verifying..." : "Verify & Save All"}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
      <PhoneChangeModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        currentPhone={user?.phone}
        onSuccess={() => {
          setIsPhoneModalOpen(false);
          const token = localStorage.getItem("token");
          if (token) {
            fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
              .then((res) => (res.ok ? res.json() : null))
              .then((freshUser) => {
                if (freshUser) {
                  onUpdate(freshUser);
                  setForm((f) => ({ ...f, phone: freshUser.phone }));
                }
              });
          }
        }}
      />
    </AnimatePresence>
  );
};

/* ── Compact field component ── */
const ProfileField = ({
  icon,
  label,
  value,
  editing,
  type = "text",
  maxLength,
  placeholder,
  error,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  editing: boolean;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  error?: string;
  onChange: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs sm:text-sm font-semibold text-gray-800">{label}</label>
    {editing ? (
      <>
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder || label}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-50 border ${
            error ? 'border-red-500 ring-2 ring-red-500/10 text-red-900' : 'border-gray-200 text-gray-700'
          } text-xs sm:text-sm placeholder:text-gray-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all`}
        />
        {error && (
          <p className="text-[11px] font-semibold text-red-500 mt-0.5 flex items-center gap-1 pl-1">
            <AlertCircle size={12} className="shrink-0" /> {error}
          </p>
        )}
      </>
    ) : (
      <div className="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs sm:text-sm text-gray-700 truncate">
        {value || <span className="text-gray-400">—</span>}
      </div>
    )}
  </div>
);

export default ProfileModal;
