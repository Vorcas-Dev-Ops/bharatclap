"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, AlertCircle } from "lucide-react";
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
    password: "",
    confirmPassword: "",
  });
  
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load existing user data from login/registration
    const storedUserStr = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");
    
    if (storedUserStr && storedToken) {
      const user = JSON.parse(storedUserStr);
      setUserId(user._id);
      setToken(storedToken);
      setRole(user.role || "customer");
      
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        phone: user.phone || "",
        name: user.name || "",
        gender: user.gender || "",
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

    const passErr = validatePassword(formData.password);
    if (passErr) newErrors.password = passErr;

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    setFieldErrors({});
    
    setLoading(true);
    try {
      // Pull role from the pending user object we verified in step 1
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
      
      const userPayload = {
        _id: data._id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        gender: formData.gender,
        profile_image: data.profile_image,
      };

      // Set auth state (localStorage & cookies) and hydrate global AuthContext
      setAuthState(data.token, data.role);
      localStorage.setItem("user", JSON.stringify(userPayload));
      loginSuccess(data.token, userPayload);
      
      // Redirect to main user dashboard after success
      if (data.role === 'provider') {
        router.push("/signup/provider/services");
      } else {
        router.push("/user/settings");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-3 sm:p-4 py-4 sm:py-8">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[460px] bg-white rounded-[1.25rem] sm:rounded-[1.75rem] shadow-xl p-5 sm:p-6 max-h-[92vh] overflow-y-auto custom-scrollbar"
      >
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4">
          <div className="h-1.5 w-5 rounded-full bg-[#1D2B83]"></div>
          <div className="h-1.5 w-5 rounded-full bg-[#1D2B83]"></div>
          <div className="h-1.5 w-5 rounded-full bg-slate-200"></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 pl-0.5">Password</label>
              <input 
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full bg-[#F5F7FA] border ${fieldErrors.password ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
              />
              {fieldErrors.password && (
                <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1 leading-snug">
                  <AlertCircle size={12} className="shrink-0" /> {fieldErrors.password}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600 pl-0.5">Confirm Password</label>
              <input 
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full bg-[#F5F7FA] border ${fieldErrors.confirmPassword ? 'border-red-500 ring-2 ring-red-500/10' : 'border-transparent'} rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all`}
              />
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1 pl-1">
                  <AlertCircle size={12} className="shrink-0" /> {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-1 pb-2">
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
    </div>
  );
}
