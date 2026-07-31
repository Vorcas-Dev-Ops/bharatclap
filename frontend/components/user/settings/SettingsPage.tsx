"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import {
  User, Phone, Mail, Lock, Shield, LogOut, ChevronRight,
  Smartphone, CheckCircle, Edit2, Camera, X, ShieldCheck, Key
} from "lucide-react";
import Link from "next/link";
import ProfileModal from "@/components/user/profile/ProfileModal";
import { motion, AnimatePresence } from "framer-motion";
import { API_URL } from "@/config/api";
import { useAuth } from "@/context/AuthContext";
import { authFetch } from "@/utils/authFetch";
import { validatePhone, validateEmail } from "@/utils/validation";

/* ─────────────────────────────── components ────────────────────────────── */

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-all duration-300 ${checked ? "bg-[#1D2B83]" : "bg-slate-200"}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${checked ? "translate-x-5" : "translate-x-0"}`} />
  </button>
);

const SectionHeader = ({ title, onEdit }: { title: string; onEdit?: () => void }) => (
  <div className="flex items-center justify-between px-1 pt-6 pb-2">
    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</p>
    {onEdit && (
      <button 
        onClick={onEdit}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-[#1D2B83] transition-colors group"
      >
        <Edit2 size={14} className="group-hover:scale-110 transition-transform" />
      </button>
    )}
  </div>
);

/* ────────────────────────── Verification Modal ─────────────────────────── */

interface VerificationModalProps {
  type: "phone" | "email" | "password";
  currentValue?: string;
  onClose: () => void;
  onSuccess: (newValue?: string) => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ type, currentValue, onClose, onSuccess }) => {
  const [step, setStep] = useState<"input" | "otp">("input");
  const [newValue, setNewValue] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleSendOtp = () => {
    setErrorMsg("");
    if (type === "phone") {
      const err = validatePhone(newValue);
      if (err) {
        setErrorMsg(err);
        return;
      }
    } else if (type === "email") {
      const err = validateEmail(newValue);
      if (err) {
        setErrorMsg(err);
        return;
      }
    }
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setStep("otp");
    }, 1500);
  };

  const handleVerifyOtp = () => {
    setLoading(true);
    // Simulate API verification
    setTimeout(() => {
      setLoading(false);
      onSuccess(type === "password" ? undefined : newValue);
    }, 1500);
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);
    if (val && index < 5) otpRefs.current[index + 1]?.focus();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#1D2B83]">
              {type === "phone" ? <Smartphone size={24} /> : type === "email" ? <Mail size={24} /> : <Key size={24} />}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400"><X size={20} /></button>
          </div>

          {step === "input" ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {type === "password" ? "Reset Password" : `Update ${type === "phone" ? "Phone" : "Email"}`}
                </h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  {type === "password" 
                    ? "We'll send an OTP to your registered info to verify it's you." 
                    : `Enter your new ${type} below to receive a verification code.`}
                </p>
              </div>

              {type !== "password" && (
                <div className="space-y-2">
                  <div className="relative">
                    {type === "phone" ? <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /> : <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />}
                    <input
                      type={type === "phone" ? "tel" : "email"}
                      placeholder={`New ${type}`}
                      value={newValue}
                      onChange={(e) => { setNewValue(e.target.value); setErrorMsg(""); }}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:border-[#1D2B83] focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  {errorMsg && <p className="text-xs text-red-500 font-bold px-1">{errorMsg}</p>}
                </div>
              )}

              <button
                onClick={handleSendOtp}
                disabled={loading || (type !== "password" && !newValue)}
                className="w-full py-4 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Sending..." : "Send Verification Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-6 text-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Verify Identity</h3>
                <p className="text-sm font-medium text-slate-500 mt-1">Enter the 6-digit code sent to your {type === "password" ? "registered contact" : newValue}</p>
              </div>

              <div className="flex justify-between gap-2">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => e.key === "Backspace" && !digit && i > 0 && otpRefs.current[i-1]?.focus()}
                    className="w-12 h-14 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-xl font-black text-[#1D2B83] focus:border-[#1D2B83] focus:bg-white transition-all outline-none"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.some(d => !d)}
                className="w-full py-4 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/20 hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>

              <button className="text-xs font-black text-[#1D2B83] hover:opacity-70 uppercase tracking-widest">Resend Code in 0:45</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

/* ────────────────────────── Privacy Policy Modal ───────────────────────── */

const PrivacyModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
    >
      <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1D2B83] flex items-center justify-center text-white"><ShieldCheck size={20} /></div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Privacy Policy</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-colors"><X size={20} /></button>
      </div>
      <div className="p-8 overflow-y-auto text-sm text-slate-600 space-y-6 leading-relaxed">
        <section>
          <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-2">1. Data Collection</h4>
          <p>We collect information you provide directly to us, such as when you create or modify your account, request on-demand services, contact customer support, or otherwise communicate with us. This information may include: name, email, phone number, postal address, profile picture, payment method, and other information you choose to provide.</p>
        </section>
        <section>
          <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-2">2. Use of Information</h4>
          <p>We use the information we collect about you to: Provide, maintain, and improve our Services, including, for example, to facilitate payments, send receipts, provide products and services you request (and send related information), develop new features, and provide customer support.</p>
        </section>
        <section>
          <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-2">3. Security</h4>
          <p>We are committed to protecting your data. We use a variety of technical, administrative, and physical methods to keep your data safe. This includes using encryption for data in transit and at rest, and strictly limiting access to your data to authorized personnel only.</p>
        </section>
        <section>
          <h4 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-2">4. Your Rights</h4>
          <p>You have the right to access, correct, or delete your personal data. You can manage most of your data directly through your account settings. For more complex requests, please contact our privacy team at privacy@bharatclap.com.</p>
        </section>
      </div>
      <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
        <button onClick={onClose} className="px-8 py-3 bg-[#1D2B83] text-white font-black rounded-2xl shadow-lg shadow-blue-900/10 hover:opacity-90 active:scale-95 transition-all">I Understand</button>
      </div>
    </motion.div>
  </div>
);

/* ────────────────────────────── main page ──────────────────────────────── */

const SettingsPage = () => {
  const { user: authUser, logout: authLogout } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [verifyType, setVerifyType] = useState<"phone" | "email" | "password" | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [bookingCount, setBookingCount] = useState<number | null>(null);
  const [rewardsCount, setRewardsCount] = useState<number | null>(null);

  useEffect(() => {
    // 1. Sync from AuthContext or localStorage initially
    if (authUser) {
      setUser(authUser);
    } else {
      const userData = localStorage.getItem("user");
      if (userData) {
        try { setUser(JSON.parse(userData)); } catch (e) { console.error(e); }
      }
    }

    // 2. Fetch fresh profile from auth-service /users/me
    const token = localStorage.getItem("token");
    if (token) {
      authFetch(`${API_URL}/users/me`)
        .then((res) => (res.ok ? res.json() : null))
        .then((freshUser) => {
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem("user", JSON.stringify(freshUser));
          }
        })
        .catch((err) => console.error("Failed to fetch user profile:", err));

      // Fetch booking stats from the API
      authFetch(`${API_URL}/bookings/my`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const list: any[] = Array.isArray(data)
            ? data
            : Array.isArray(data?.bookings)
            ? data.bookings
            : [];
          setBookingCount(list.length);
          setRewardsCount(list.filter((b) => b.status === "completed").length);
        })
        .catch((err) => console.error("Failed to fetch booking stats:", err));
    }
  }, [authUser]);

  const handleUpdateUser = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
    window.dispatchEvent(new Event("storage"));
  };


  const RowLink = ({ icon: Icon, label, sub, onClick, href, danger = false }: any) => {
    const content = (
      <div className={`flex items-center gap-4 px-4 py-4 rounded-2xl transition-all group hover:bg-slate-50 ${danger ? "text-red-500 hover:bg-red-50" : ""}`}>
        <div className={`w-10 h-10 rounded-[18px] flex items-center justify-center flex-shrink-0 ${danger ? "bg-red-100" : "bg-slate-100 group-hover:bg-blue-100"}`}>
          <Icon className={`w-4 h-4 ${danger ? "text-red-500" : "text-slate-500 group-hover:text-[#1D2B83]"} transition-colors`} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-black ${danger ? "text-red-500" : "text-slate-800"}`}>{label}</p>
          {sub && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p>}
        </div>
        <ChevronRight className={`w-4 h-4 ${danger ? "text-red-300" : "text-slate-300 group-hover:text-slate-500"} transition-colors`} />
      </div>
    );
    if (onClick) return <button onClick={onClick} className="w-full text-left">{content}</button>;
    return <Link href={href ?? "#"} className="block">{content}</Link>;
  };


  const initials = user?.name ? user.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2) : "??";

  return (
    <main className="min-h-screen bg-[#F8FAFF]">
      <Navbar />

      <AnimatePresence>
        {verifyType && (
          <VerificationModal 
            type={verifyType} 
            onClose={() => setVerifyType(null)} 
            onSuccess={(val) => {
              if (val) handleUpdateUser({ ...user, [verifyType]: val });
              setVerifyType(null);
            }} 
          />
        )}
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Settings</h1>
          <p className="text-slate-400 mt-2 font-medium text-base">Manage your account and preferences</p>
        </div>

        {/* PROFILE SUMMARY CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-blue-900/5 p-12 mb-12 relative overflow-hidden group"
        >
          {/* Elegant background elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full -mr-48 -mt-48 blur-3xl opacity-60 group-hover:opacity-80 transition-opacity" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-slate-50 rounded-full -ml-32 -mb-32 blur-3xl opacity-40" />
          
          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="relative group/avatar">
              <div className="w-32 h-32 rounded-[3rem] bg-gradient-to-br from-[#1D2B83] to-blue-600 flex items-center justify-center shadow-2xl shadow-blue-200 overflow-hidden ring-8 ring-white">
                {user?.profile_image ? (
                  <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500" />
                ) : (
                  <span className="text-white text-4xl font-black">{initials}</span>
                )}
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">{user?.name || "Guest User"}</h2>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Account Active
                    </div>
                    <button
                      onClick={() => setIsProfileModalOpen(true)}
                      className="px-4 py-1.5 bg-[#1D2B83] text-white hover:bg-blue-900 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Edit2 size={12} />
                      Edit Profile
                    </button>
                  </div>
                </div>
                <p className="text-lg font-medium text-slate-400 mt-1">{user?.email || "No email provided"}</p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm text-xs font-bold text-slate-600 transition-all hover:bg-white">
                  <Smartphone size={16} className="text-[#1D2B83]" />
                  {user?.phone || "No phone"}
                </div>
                {user?.gender && (
                  <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm text-xs font-bold text-slate-600 transition-all hover:bg-white">
                    <User size={16} className="text-[#1D2B83]" />
                    {user.gender}
                  </div>
                )}
              </div>
            </div>

            {/* Live stats */}
            <div className="hidden xl:flex items-center gap-6 px-8 border-l border-slate-100">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bookings</p>
                {bookingCount === null ? (
                  <div className="h-8 w-8 mx-auto rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <p className="text-2xl font-black text-slate-900">{bookingCount}</p>
                )}
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Rewards</p>
                {rewardsCount === null ? (
                  <div className="h-8 w-8 mx-auto rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <p className="text-2xl font-black text-slate-900">{rewardsCount}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SECURITY */}
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-blue-900/5 overflow-hidden p-6">
            <SectionHeader title="Account Security" />
            <RowLink icon={Smartphone} label="Update Phone"    sub={`Current: ${user?.phone || "Not set"}`} onClick={() => setVerifyType("phone")} />
            <RowLink icon={Mail}       label="Update Email"    sub={`Current: ${user?.email || "Not set"}`} onClick={() => setVerifyType("email")} />
            <RowLink icon={Lock}       label="Change Password" sub="OTP Verification required"              onClick={() => setVerifyType("password")} />
          </div>

          {/* PRIVACY & LOGOUT */}
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-blue-900/5 overflow-hidden p-6">
            <SectionHeader title="Account" />
            <RowLink icon={Shield} label="Privacy Policy" sub="How we use your data" onClick={() => setShowPrivacy(true)} />
            <RowLink
              icon={LogOut}
              label="Logout"
              sub="Sign out of your account"
              onClick={() => {
                localStorage.removeItem("token");
                localStorage.removeItem("user");
                window.location.href = "/login";
              }}
            />
          </div>
        </div>
      </div>

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={handleUpdateUser}
      />
      <Footer />
    </main>
  );
};

export default SettingsPage;
