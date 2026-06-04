"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { API_URL } from '@/config/api';

export default function CustomerProfileForm() {
  const router = useRouter();
  
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
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if(error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      setError("Please enter your full name");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
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
      if (!res.ok) throw new Error(data.message || "Failed to complete registration");
      
      // Replace the fake pending session with the genuine authenticated session!
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({
        _id: data._id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role,
        gender: formData.gender,
        profile_image: data.profile_image,
      }));
      
      // Redirect to main app/dashboard after success
      if (data.role === 'provider') {
        router.push("/signup/provider/services");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-4 py-12 sm:py-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[500px] bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-xl p-6 sm:p-10"
      >
        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-10">
          <div className="h-1.5 w-6 rounded-full bg-[#1D2B83]"></div>
          <div className="h-1.5 w-6 rounded-full bg-[#1D2B83]"></div>
          <div className="h-1.5 w-6 rounded-full bg-slate-200"></div>
        </div>

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D2B83] tracking-tight mb-2 sm:mb-3">
            {role === 'provider' ? "Complete Your Profile" : "Tell us about you."}
          </h1>
          <p className="text-slate-500 font-medium text-xs sm:text-[15px] max-w-[320px] mx-auto text-balance">
            {role === 'provider' 
              ? "Tell us more about yourself to start providing services."
              : "Personalize your experience to receive the highest standard of services."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 pl-1">Full Name</label>
            <input 
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your full name"
              className="w-full bg-[#F5F7FA] border border-transparent rounded-xl px-4 py-3.5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 pl-1">Email</label>
            <input 
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isEmailVerified}
              placeholder="Enter your email"
              className="w-full bg-[#F5F7FA] border border-transparent rounded-xl px-4 py-3.5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 pl-1">Phone number</label>
            <input 
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={isPhoneVerified}
              placeholder="Enter phone number"
              className="w-full bg-[#F5F7FA] border border-transparent rounded-xl px-4 py-3.5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          {/* Password Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 pl-1">Password</label>
              <input 
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-[#F5F7FA] border border-transparent rounded-xl px-4 py-3.5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 pl-1">Confirm Password</label>
              <input 
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-[#F5F7FA] border border-transparent rounded-xl px-4 py-3.5 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-1 pb-4">
            <label className="text-xs font-bold text-slate-600 pl-1">Gender</label>
            <div className="relative">
              <select 
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full bg-[#F5F7FA] border border-transparent rounded-xl pl-4 pr-10 py-3.5 text-slate-900 font-medium appearance-none focus:outline-none focus:border-[#1D2B83] focus:bg-white transition-all"
              >
                <option value="" disabled className="text-slate-400">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <ChevronDown className="w-5 h-5 text-[#1D2B83]" />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium text-center pb-2">{error}</p>
          )}

          {/* Submit */}
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#202B7D] hover:bg-[#161F63] text-white font-bold py-4 rounded-full flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? "Saving..." : "Continue"}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
