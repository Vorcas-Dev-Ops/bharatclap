"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, AlertCircle, Eye, EyeOff, Lock, Phone, Mail, KeyRound, X, Check } from "lucide-react";
import { API_URL } from '@/config/api';

import { validateName, validateEmail, validatePhone, validatePassword } from "@/utils/validation";
import { useAuth } from "@/context/AuthContext";
import { setAuthState } from "@/utils/auth";

export default function CustomerProfileForm() {
  const router = useRouter();
  const { loginSuccess } = useAuth();
  
  const [userId, setUserId] = useState("");
  const [token, setToken] = useState("");
  const [role, setRole] = useState("customer");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    date_of_birth: "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });
  
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Forgot Password Modal State
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'phone' | 'email'>('email');
  const [forgotTarget, setForgotTarget] = useState("");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotOtp, setForgotOtp] = useState(["", "", "", "", "", ""]);
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

  // Restore temporary draft from sessionStorage
  useEffect(() => {
    try {
      const savedTemp = sessionStorage.getItem("provider_profile_temp");
      if (savedTemp) {
        const parsed = JSON.parse(savedTemp);
        setFormData(prev => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {}
  }, []);

  // Save changes to sessionStorage so going forward and back never loses typed fields/passwords
  useEffect(() => {
    try {
      if (formData.name || formData.password || formData.confirmPassword || formData.currentPassword) {
        sessionStorage.setItem("provider_profile_temp", JSON.stringify(formData));
      }
    } catch {}
  }, [formData]);

  useEffect(() => {
    // Load existing user data from login/registration
    const storedUserStr = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    
    if (storedUserStr && storedToken) {
      const user = JSON.parse(storedUserStr);
      setUserId(user.id || user._id);
      setToken(storedToken);
      setRole(user.role || "customer");
      
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        phone: user.phone || "",
        name: user.name || "",
        gender: user.gender || "",
        date_of_birth: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : "",
      }));

      // Lock verified fields
      if (user.email) setIsEmailVerified(true);
      if (user.phone) setIsPhoneVerified(true);
    } else {
      // If no active session, send back to signup
      router.push("/signup");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const nameErr = validateName(formData.name);
    if (nameErr) newErrors.name = nameErr;

    if (formData.email) {
      const emailErr = validateEmail(formData.email);
      if (emailErr) newErrors.email = emailErr;
    }

    if (formData.phone) {
      const phoneErr = validatePhone(formData.phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }

    // Age validation: Providers must be 18+
    if (role === 'provider' && !formData.date_of_birth) {
      newErrors.date_of_birth = "Date of birth is required. Minimum age is 18.";
    } else if (formData.date_of_birth) {
      const dob = new Date(formData.date_of_birth);
      const today = new Date();
      if (isNaN(dob.getTime())) {
        newErrors.date_of_birth = "Please enter a valid date of birth.";
      } else {
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
          age--;
        }
        if (age < 18) {
          newErrors.date_of_birth = "You must be at least 18 years old to register as a provider.";
        } else if (age > 100) {
          newErrors.date_of_birth = "Please enter a valid date of birth.";
        }
      }
    }

    const isExistingUser = Boolean(token && userId);

    if (isExistingUser) {
      if (formData.password) {
        if (!formData.currentPassword) {
          newErrors.currentPassword = "Old (current) password is required to change password.";
        }
        const passErr = validatePassword(formData.password);
        if (passErr) newErrors.password = passErr;

        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = "Passwords do not match.";
        }
      }
    } else {
      const passErr = validatePassword(formData.password);
      if (passErr) newErrors.password = passErr;

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});
    
    setLoading(true);
    try {
      const storedToken = localStorage.getItem("token") || token;
      let userPayload: any;

      if (storedToken && userId) {
        // User already exists and is updating profile
        const updateBody: any = {
          name: formData.name,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth || undefined,
        };

        if (formData.password) {
          updateBody.currentPassword = formData.currentPassword;
          updateBody.newPassword = formData.password;
        }

        const res = await fetch(`${API_URL}/users/me`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
          },
          body: JSON.stringify(updateBody),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to update profile");
        }

        userPayload = {
          _id: userId,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: role,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          profile_image: data.profile_image || undefined,
        };
      } else {
        // Brand new registration
        const pendingSessionStr = localStorage.getItem("user");
        const pendingUser = pendingSessionStr ? JSON.parse(pendingSessionStr) : {};

        const res = await fetch(`${API_URL}/users/register`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            gender: formData.gender,
            date_of_birth: formData.date_of_birth || undefined,
            password: formData.password,
            role: pendingUser.role || 'customer'
          }),
        });
        
        const data = await res.json();
        if (!res.ok) {
          if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
            const backendFieldErrors: Record<string, string> = {};
            data.errors.forEach((err: any) => {
              if (err.path) backendFieldErrors[err.path] = err.message;
            });
            setFieldErrors(backendFieldErrors);
            throw new Error(data.errors[0].message);
          }
          throw new Error(data.message || "Failed to complete registration");
        }

        userPayload = {
          _id: data._id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role,
          gender: formData.gender,
          date_of_birth: formData.date_of_birth,
          profile_image: data.profile_image,
        };

        setAuthState(data.token, data.role);
      }

      sessionStorage.removeItem("provider_profile_temp");
      localStorage.setItem("user", JSON.stringify(userPayload));
      loginSuccess(storedToken || userPayload.token, userPayload);
      
      // Redirect to main user dashboard or next provider step
      if ((userPayload.role || role) === 'provider') {
        router.push("/provider/onboarding");
      } else {
        router.push("/user/settings");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotOtpChange = (idx: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const next = [...forgotOtp];
    next[idx] = val;
    setForgotOtp(next);
    if (val && idx < 5) {
      const nextInput = document.getElementById(`forgot-otp-${idx + 1}`);
      nextInput?.focus();
    }
  };

  const handleSendForgotOtp = async () => {
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    try {
      const identifier = (forgotTarget || (forgotMethod === 'email' ? formData.email : formData.phone)).trim();
      if (!identifier) {
        throw new Error(`Please provide your ${forgotMethod === 'email' ? 'email address' : 'phone number'}.`);
      }

      const res = await fetch(`${API_URL}/users/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [forgotMethod]: identifier,
          identifier: identifier
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP.");

      setForgotSuccess(`OTP sent to ${identifier}!`);
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyForgotOtp = async () => {
    const otpValue = forgotOtp.join("").trim();
    if (otpValue.length < 6) {
      setForgotError("Please enter the full 6-digit OTP code.");
      return;
    }
    setForgotLoading(true);
    setForgotError("");
    try {
      const identifier = (forgotTarget || (forgotMethod === 'email' ? formData.email : formData.phone)).trim();
      const res = await fetch(`${API_URL}/users/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier,
          [forgotMethod]: identifier,
          otp: otpValue
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP code.");

      setForgotSuccess("OTP verified! Please set your new password.");
      setForgotStep(3);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordFinal = async () => {
    if (forgotNewPass.length < 6) {
      setForgotError("New password must be at least 6 characters.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError("Passwords do not match.");
      return;
    }

    setForgotLoading(true);
    setForgotError("");
    try {
      const identifier = (forgotTarget || (forgotMethod === 'email' ? formData.email : formData.phone)).trim();
      const res = await fetch(`${API_URL}/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier,
          [forgotMethod]: identifier,
          otp: forgotOtp.join("").trim(),
          password: forgotNewPass
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reset password.");

      setForgotSuccess("Password updated successfully!");
      setFormData(prev => ({
        ...prev,
        currentPassword: forgotNewPass,
        password: "",
        confirmPassword: ""
      }));
      setTimeout(() => {
        setForgotModalOpen(false);
        setForgotSuccess("");
      }, 1500);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-3 sm:p-4 py-4 sm:py-8">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[460px] bg-white rounded-[1.25rem] sm:rounded-[1.75rem] shadow-xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto custom-scrollbar"
      >
        {/* Stepper (Step 1 of 5) */}
        <div className="flex items-center justify-center gap-1.5 mb-3 sm:mb-4">
          <div className="h-1.5 w-6 rounded-full bg-[#1D2B83] transition-all"></div>
          <div className="h-1.5 w-4 rounded-full bg-slate-100 transition-all"></div>
          <div className="h-1.5 w-4 rounded-full bg-slate-100 transition-all"></div>
          <div className="h-1.5 w-4 rounded-full bg-slate-100 transition-all"></div>
          <div className="h-1.5 w-4 rounded-full bg-slate-100 transition-all"></div>
        </div>

        {/* Header */}
        <div className="text-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1D2B83] tracking-tight mb-1">
            {role === 'provider' ? "Complete Your Profile" : "Tell us about you."}
          </h1>
          <p className="text-slate-500 font-medium text-xs max-w-[300px] mx-auto text-balance">
            {role === 'provider' 
              ? "Tell us more about yourself to start providing services."
              : "Personalize your experience to receive the highest standard of services."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-2.5">
          
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 pl-0.5">Full Name</label>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className={`w-full bg-[#F5F7FA] border ${fieldErrors.name ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
            />
            {fieldErrors.name && (
              <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                <AlertCircle size={12} className="shrink-0" /> {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 pl-0.5">Email</label>
            <input 
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isEmailVerified}
              placeholder="Enter your email"
              className={`w-full bg-[#F5F7FA] border ${fieldErrors.email ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
            />
            {fieldErrors.email && (
              <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                <AlertCircle size={12} className="shrink-0" /> {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 pl-0.5">Phone number</label>
            <input 
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={isPhoneVerified}
              placeholder="Enter phone number"
              className={`w-full bg-[#F5F7FA] border ${fieldErrors.phone ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
            />
            {fieldErrors.phone && (
              <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                <AlertCircle size={12} className="shrink-0" /> {fieldErrors.phone}
              </p>
            )}
          </div>

          {/* Password Section */}
          {userId ? (
            <div className="space-y-3 bg-[#F8FAFC] p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700">Security & Password</span>
                <button
                  type="button"
                  onClick={() => {
                    const defaultTarget = formData.email || formData.phone || "";
                    setForgotMethod(formData.email ? 'email' : 'phone');
                    setForgotTarget(defaultTarget);
                    setForgotModalOpen(true);
                    setForgotStep(1);
                    setForgotError("");
                    setForgotSuccess("");
                    setForgotOtp(["", "", "", "", "", ""]);
                  }}
                  className="text-[11px] font-bold text-[#1D2B83] hover:underline transition-colors"
                >
                  Forgot password? Reset via OTP
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 pl-0.5">
                  Current (Old) Password <span className="text-slate-400 font-normal">(Required only if changing)</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleChange}
                    placeholder="Enter current password"
                    className={`w-full bg-white border ${fieldErrors.currentPassword ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.currentPassword && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                    <AlertCircle size={12} className="shrink-0" /> {fieldErrors.currentPassword}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 pl-0.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter new password"
                      className={`w-full bg-white border ${fieldErrors.password ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1 leading-snug">
                      <AlertCircle size={12} className="shrink-0" /> {fieldErrors.password}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 pl-0.5">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm new password"
                      className={`w-full bg-white border ${fieldErrors.confirmPassword ? 'border-red-500 ring-2 ring-red-500/10' : 'border-slate-200'} rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                      <AlertCircle size={12} className="shrink-0" /> {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 pl-0.5">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full bg-[#F5F7FA] border ${fieldErrors.password ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1 leading-snug">
                    <AlertCircle size={12} className="shrink-0" /> {fieldErrors.password}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 pl-0.5">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`w-full bg-[#F5F7FA] border ${fieldErrors.confirmPassword ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 pr-10 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                    <AlertCircle size={12} className="shrink-0" /> {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Date of Birth & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Date of Birth */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 pl-0.5">
                Date of Birth {role === 'provider' && <span className="text-red-500">* (18+)</span>}
              </label>
              <input 
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                onChange={handleChange}
                className={`w-full bg-[#F5F7FA] border ${fieldErrors.date_of_birth ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
              />
              {fieldErrors.date_of_birth && (
                <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1 leading-snug">
                  <AlertCircle size={12} className="shrink-0" /> {fieldErrors.date_of_birth}
                </p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 pl-0.5">Gender</label>
              <div className="relative">
                <select 
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-[#F5F7FA] border border-transparent rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 font-medium appearance-none focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all"
                >
                  <option value="" disabled className="text-slate-400">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-[#1D2B83]" />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium text-center pb-1 flex items-center justify-center gap-1">
              <AlertCircle size={13} /> {error}
            </p>
          )}

          {/* Submit */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#202B7D] hover:bg-[#161F63] text-white font-bold py-3 sm:py-3.5 rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed mt-3"
          >
            {loading ? "Saving..." : "Continue"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </motion.div>

      {/* Forgot Password Reset Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[380px] bg-white rounded-3xl shadow-2xl p-6 relative border border-slate-100">
            <button
              type="button"
              onClick={() => setForgotModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-blue-50 text-[#1D2B83] rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                <KeyRound size={22} />
              </div>
              <h3 className="text-base font-extrabold text-[#1D2B83]">Reset Password via OTP</h3>
              <p className="text-xs text-slate-500 mt-1">
                {forgotStep === 1 && "Choose where you want to receive your reset OTP."}
                {forgotStep === 2 && "Enter the 6-digit verification code."}
                {forgotStep === 3 && "Create your new secure password."}
              </p>
            </div>

            {forgotError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-semibold flex items-center gap-2">
                <Check size={14} className="shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* Step 1: Choose Method */}
            {forgotStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMethod('phone');
                      setForgotTarget(formData.phone || '');
                      setForgotError("");
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      forgotMethod === 'phone'
                        ? 'border-[#1D2B83] bg-blue-50/50 text-[#1D2B83]'
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <Phone size={18} className="mb-1" />
                    <span className="text-xs font-bold">Phone OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMethod('email');
                      setForgotTarget(formData.email || '');
                      setForgotError("");
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${
                      forgotMethod === 'email'
                        ? 'border-[#1D2B83] bg-blue-50/50 text-[#1D2B83]'
                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <Mail size={18} className="mb-1" />
                    <span className="text-xs font-bold">Email OTP</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 pl-0.5">
                    {forgotMethod === 'email' ? 'Send OTP to Email Address' : 'Send OTP to Phone Number'}
                  </label>
                  <input
                    type={forgotMethod === 'email' ? 'email' : 'tel'}
                    value={forgotTarget}
                    onChange={(e) => setForgotTarget(e.target.value)}
                    placeholder={forgotMethod === 'email' ? 'e.g. user@gmail.com' : 'e.g. +919876543210'}
                    className="w-full text-xs font-medium px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1D2B83] outline-none transition-all"
                  />
                  <p className="text-[10px] text-slate-400 pl-0.5">
                    {forgotMethod === 'email' 
                      ? 'Ensure this is your registered account email.' 
                      : 'Ensure this is your registered account phone number.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSendForgotOtp}
                  disabled={forgotLoading}
                  className="w-full bg-[#1D2B83] text-white py-3 rounded-xl font-bold text-xs hover:bg-[#161F63] transition-all flex items-center justify-center gap-2"
                >
                  {forgotLoading ? "Sending Code..." : "Send Reset Code"}
                  {!forgotLoading && <ArrowRight size={14} />}
                </button>
              </div>
            )}

            {/* Step 2: Enter OTP */}
            {forgotStep === 2 && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-600">
                    Enter the 6-digit verification code sent to:
                  </p>
                  <p className="text-xs font-bold text-[#1D2B83] break-all">
                    {forgotTarget || (forgotMethod === 'email' ? formData.email : formData.phone)}
                  </p>
                  {forgotMethod === 'email' && (
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2 mt-2 text-[11px] text-amber-800 leading-snug">
                      💡 <b>Check Spam/Junk:</b> Automated OTP emails can sometimes land in Spam or Promotions.
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-2 pt-1">
                  {forgotOtp.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`forgot-otp-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleForgotOtpChange(idx, e.target.value)}
                      className="w-10 h-12 text-center text-lg font-bold border-2 border-slate-200 focus:border-[#1D2B83] rounded-xl outline-none transition-all"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    Change method / details
                  </button>
                  <button
                    type="button"
                    onClick={handleSendForgotOtp}
                    disabled={forgotLoading}
                    className="text-[#1D2B83] font-bold hover:underline"
                  >
                    Resend Code
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyForgotOtp}
                  disabled={forgotLoading || forgotOtp.join("").length < 6}
                  className="w-full bg-[#1D2B83] text-white py-3 rounded-xl font-bold text-xs hover:bg-[#161F63] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {forgotLoading ? "Verifying..." : "Verify Code"}
                  {!forgotLoading && <ArrowRight size={14} />}
                </button>
              </div>
            )}

            {/* Step 3: Set New Password */}
            {forgotStep === 3 && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">New Password</label>
                  <input
                    type="password"
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1D2B83] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600">Confirm New Password</label>
                  <input
                    type="password"
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:border-[#1D2B83] outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResetPasswordFinal}
                  disabled={forgotLoading || !forgotNewPass}
                  className="w-full bg-[#1D2B83] text-white py-3 rounded-xl font-bold text-xs hover:bg-[#161F63] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {forgotLoading ? "Updating Password..." : "Set New Password"}
                  {!forgotLoading && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
