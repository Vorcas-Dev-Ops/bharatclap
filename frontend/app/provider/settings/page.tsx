"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Bell,
  Shield,
  ToggleRight,
  ToggleLeft as Toggle,
  ChevronRight,
  LogOut,
  Smartphone,
  Globe,
  Trash2,
  Lock,
  Zap,
  Check,
  X,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/config/api";
import Cookies from "js-cookie";

export default function SettingsPage() {
  const router = useRouter();

  // Store & Settings State
  const [onlineStatus, setOnlineStatus] = useState<boolean>(true);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [globalNotifs, setGlobalNotifs] = useState<boolean>(true);
  const [language, setLanguage] = useState<string>("English (US)");
  const [appearance, setAppearance] = useState<string>("System (Light)");

  // Feedback Toast
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isLangModalOpen, setIsLangModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState("");

  // Delete Account State
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Connected Devices State
  const [devices, setDevices] = useState([
    { id: "1", device: "iPhone 15 Pro", location: "New Delhi", active: true },
    { id: "2", device: "MacBook Air", location: "Gurgaon", active: false }
  ]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastMsg({ type, message });
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    // Load stored preferences
    const savedLang = localStorage.getItem("provider_language");
    if (savedLang) setLanguage(savedLang);

    const savedTheme = localStorage.getItem("provider_appearance");
    if (savedTheme) setAppearance(savedTheme);

    const savedNotif = localStorage.getItem("provider_global_notifs");
    if (savedNotif !== null) setGlobalNotifs(savedNotif === "true");

    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (token) {
          const res = await apiClient.get("/providers/me");
          if (res.data?.availability_status) {
            setOnlineStatus(res.data.availability_status === "available");
          }
        }
      } catch (err) {
        console.error("Failed to fetch provider status:", err);
      }
    };
    fetchStatus();
  }, []);

  // Store Status Toggle Handler
  const handleToggleStatus = async () => {
    if (updatingStatus) return;
    setUpdatingStatus(true);
    const newStatusStr = !onlineStatus ? "available" : "offline";
    try {
      await apiClient.put("/providers/availability", { status: newStatusStr });
      setOnlineStatus(!onlineStatus);
      window.dispatchEvent(new CustomEvent("providerStatusChanged", { detail: newStatusStr }));
      showToast('success', `Store status set to ${newStatusStr === 'available' ? 'Online' : 'Offline'}`);
    } catch (err: any) {
      console.error("Failed to update status", err);
      showToast('error', err.response?.data?.message || 'Failed to update store status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Notification Preference Toggle Handler
  const handleToggleNotifs = () => {
    const nextVal = !globalNotifs;
    setGlobalNotifs(nextVal);
    localStorage.setItem("provider_global_notifs", String(nextVal));
    showToast('success', `Global notifications ${nextVal ? 'enabled' : 'disabled'}`);
  };

  // Language Selection Handler
  const handleSelectLanguage = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem("provider_language", lang);
    setIsLangModalOpen(false);
    showToast('success', `Language changed to ${lang}`);
  };

  // Appearance Selection Handler
  const handleSelectAppearance = (theme: string) => {
    setAppearance(theme);
    localStorage.setItem("provider_appearance", theme);
    setIsThemeModalOpen(false);
    showToast('success', `Appearance set to ${theme}`);
  };

  // Password Change Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");

    if (!passwordForm.currentPassword) {
      setPassError("Current password is required");
      return;
    }
    if (!passwordForm.newPassword) {
      setPassError("New password is required");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPassError("New password must be at least 6 characters");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPassError("New passwords do not match");
      return;
    }

    setPassLoading(true);
    try {
      await apiClient.put("/users/me", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setIsPasswordModalOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      showToast('success', "Password changed successfully");
    } catch (err: any) {
      setPassError(err.response?.data?.message || "Failed to change password. Please check your current password.");
    } finally {
      setPassLoading(false);
    }
  };

  // Account Deletion Handler
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") return;
    setDeleteLoading(true);
    try {
      await apiClient.delete("/users/me").catch(() => { });
      localStorage.clear();
      Cookies.remove("token");
      Cookies.remove("userRole");
      window.location.href = "/login";
    } catch (err: any) {
      showToast('error', "Failed to delete account. Please contact support.");
      setDeleteLoading(false);
    }
  };

  // Sign Out Handler
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await apiClient.put("/providers/availability", { status: 'offline' }).catch(() => { });
      }
      await apiClient.post("/users/logout", {}).catch(() => { });
    } catch (e) {
      console.error(e);
    }
    localStorage.clear();
    Cookies.remove("token");
    Cookies.remove("userRole");
    window.location.href = "/login";
  };

  // Remove Device Handler
  const handleRemoveDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id));
    showToast('success', "Device disconnected successfully");
  };

  return (
    <div className="w-full space-y-4">

        {/* Toast Alert */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-3 ${toastMsg.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-rose-600 text-white border-rose-500'
                }`}
            >
              {toastMsg.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {toastMsg.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage your app experience and security preferences.</p>
          </div>

          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${onlineStatus ? "bg-emerald-50/80 border-emerald-200" : "bg-slate-50 border-slate-200"
            }`}>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Store Status</span>
              <span className={`text-xs font-bold ${onlineStatus ? "text-emerald-700" : "text-slate-500"}`}>
                {onlineStatus ? "• Online" : "• Offline"}
              </span>
            </div>
            <button
              onClick={handleToggleStatus}
              disabled={updatingStatus}
              className="p-1 hover:scale-105 transition-transform disabled:opacity-50"
            >
              {updatingStatus ? (
                <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
              ) : onlineStatus ? (
                <ToggleRight className="h-8 w-8 text-emerald-600" />
              ) : (
                <Toggle className="h-8 w-8 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Columns: Settings Sections */}
          <div className="lg:col-span-2 space-y-5">

            {/* Section 1: Account Preferences */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Preferences</h2>
              </div>
              <div className="divide-y divide-slate-100">

                {/* Global Notifications */}
                <div
                  onClick={handleToggleNotifs}
                  className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-slate-50/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all">
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Global Notifications</h3>
                      <p className="text-xs font-medium text-slate-500">Receive alerts for bookings, payments, and updates</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleToggleNotifs(); }}>
                    {globalNotifs ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <Toggle className="h-8 w-8 text-slate-300" />
                    )}
                  </button>
                </div>

                {/* Language */}
                <div
                  onClick={() => setIsLangModalOpen(true)}
                  className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-slate-50/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Language</h3>
                      <p className="text-xs font-medium text-slate-500">{language}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-all" />
                </div>

                {/* App Appearance */}
                <div
                  onClick={() => setIsThemeModalOpen(true)}
                  className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-slate-50/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">App Appearance</h3>
                      <p className="text-xs font-medium text-slate-500">{appearance}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-all" />
                </div>

              </div>
            </div>

            {/* Section 2: Security & Privacy */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Security & Privacy</h2>
              </div>
              <div className="divide-y divide-slate-100">

                {/* Password & Security */}
                <div
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-slate-50/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all">
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Password & Security</h3>
                      <p className="text-xs font-medium text-slate-500">Update your password and manage account credentials</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-all" />
                </div>

                {/* Privacy Policy */}
                <div
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="p-4 sm:p-4.5 flex items-center justify-between hover:bg-slate-50/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary rounded-xl transition-all">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Privacy Policy</h3>
                      <p className="text-xs font-medium text-slate-500">Learn how BharatClap protects and manages your data</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-all" />
                </div>

              </div>
            </div>

            {/* Danger Zone: Delete Account */}
            <div className="bg-rose-50/70 p-4.5 sm:p-5 rounded-2xl border border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-sm">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Delete Account</h3>
                  <p className="text-xs font-medium text-rose-600/80">Permanently remove your provider profile and data.</p>
                </div>
              </div>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all shadow-sm"
              >
                Delete
              </button>
            </div>

          </div>

          {/* Right Column: Subscription & Connected Devices */}
          <div className="space-y-5">

            {/* Professional Subscription Card */}
            <div className="bg-primary rounded-2xl p-6 text-white shadow-lg shadow-primary/20 flex flex-col justify-between gap-4 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Professional Membership</h3>
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-bold uppercase">Active Tier</span>
                </div>
              </div>
              <p className="text-primary-light text-xs font-medium leading-relaxed">
                Upgrade to unlock higher booking visibility, lower commission rates, and priority dispatch.
              </p>
              <button
                onClick={() => router.push("/provider/membership")}
                className="w-full py-2.5 bg-white text-primary rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-primary-dark hover:text-white transition-all shadow-md"
              >
                Upgrade Now
              </button>
            </div>

            {/* Connected Devices */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Connected Devices</h3>
              <div className="space-y-2.5">
                {devices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="block text-xs font-bold text-slate-900">{d.device}</span>
                      <span className="block text-[10px] font-medium text-slate-400">{d.location}</span>
                    </div>
                    {d.active ? (
                      <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <Check className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRemoveDevice(d.id)}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-rose-200 text-rose-600 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm group"
            >
              <LogOut className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>

          </div>

        </div>

        {/* MODALS */}

      {/* Language Modal */}
      <AnimatePresence>
        {isLangModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Select Language</h3>
                <button onClick={() => setIsLangModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  "English (US)",
                  "Hindi / हिंदी",
                  "Bengali / বাংলা",
                  "Tamil / தமிழ்",
                  "Telugu / తెలుగు",
                  "Kannada / ಕನ್ನಡ"
                ].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleSelectLanguage(lang.split(" / ")[0])}
                    className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${language === lang.split(" / ")[0]
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                  >
                    <span>{lang}</span>
                    {language === lang.split(" / ")[0] && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appearance Modal */}
      <AnimatePresence>
        {isThemeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-sm w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">App Appearance</h3>
                <button onClick={() => setIsThemeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  "System (Light)",
                  "Light Theme",
                  "Dark Mode"
                ].map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleSelectAppearance(theme)}
                    className={`w-full p-3 rounded-xl border text-left text-xs font-bold transition-all flex items-center justify-between ${appearance === theme
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                  >
                    <span>{theme}</span>
                    {appearance === theme && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-md w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900">Change Password</h3>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {passError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {passError}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={passwordForm.currentPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={passwordForm.newPassword}
                      onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Enter new password (min 6 chars)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passLoading}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {passLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Update Password
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {isPrivacyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-lg w-full space-y-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900">Privacy Policy</h3>
                </div>
                <button onClick={() => setIsPrivacyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-3 text-xs text-slate-600 leading-relaxed pr-2">
                <p className="font-bold text-slate-900">1. Data Collection & Security</p>
                <p>BharatClap values your privacy. We collect essential information such as location, contact details, and bank account verification details solely for dispatching jobs and processing payouts safely.</p>

                <p className="font-bold text-slate-900">2. Encryption Standards</p>
                <p>All sensitive documents, Aadhar details, and financial transactions are encrypted using AES-256 standards before being transmitted or saved.</p>

                <p className="font-bold text-slate-900">3. Information Sharing</p>
                <p>We do not sell or rent partner data to third parties. Limited contact info is shared only with customers during an active service booking for coordination.</p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <button
                  onClick={() => setIsPrivacyModalOpen(false)}
                  className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-2xl p-6 max-w-md w-full space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-3 bg-rose-100 rounded-xl">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Delete Account</h3>
                  <p className="text-xs text-rose-600 font-bold">This action cannot be undone!</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Deleting your account will permanently wipe your profile, service history, earnings ledger, and active subscriptions. Type <strong className="text-slate-900">DELETE</strong> to confirm.
              </p>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-500 uppercase"
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText.trim().toUpperCase() !== "DELETE" || deleteLoading}
                  className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Permanently Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
