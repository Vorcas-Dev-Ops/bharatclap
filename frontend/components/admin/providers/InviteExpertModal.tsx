"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Mail, Phone, Briefcase, User as UserIcon, Save, ShieldCheck, ChevronDown, Plus, Minus, FileText, Loader2 } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface InviteExpertModalProps {
   isOpen: boolean;
   onClose: () => void;
   onAdd: (provider: any) => void;
}

const InviteExpertModal: React.FC<InviteExpertModalProps> = ({ isOpen, onClose, onAdd }) => {
   const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'provider',
      profile_image: ''
   });
   const [imagePreview, setImagePreview] = useState<string | null>(null);
   const [selectedServiceInput, setSelectedServiceInput] = useState('');
   const [isServiceOpen, setIsServiceOpen] = useState(false);
   const [categories, setCategories] = useState<any[]>([]);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [mounted, setMounted] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [apiError, setApiError] = useState<string | null>(null);

   useEffect(() => {
      const fetchCategories = async () => {
         try {
            const response = await fetch(`${API_URL}/categories`);
            const data = await response.json();
            setCategories(data);
         } catch (error) {
            console.error('Error fetching categories:', error);
         }
      };
      fetchCategories();
   }, []);

   React.useEffect(() => {
      setMounted(true);
      if (isOpen) {
         document.body.style.overflow = 'hidden';
         setErrors({});
         setFormData({ name: '', email: '', phone: '', password: '', role: 'provider', profile_image: '' });
         setImagePreview(null);
      } else {
         document.body.style.overflow = 'unset';
      }
      return () => {
         document.body.style.overflow = 'unset';
      };
   }, [isOpen]);

   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            setFormData({ ...formData, profile_image: reader.result as string });
            setImagePreview(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const validate = () => {
      const newErrors: Record<string, string> = {};

      // Name Validation: Characters only
      if (!formData.name.trim()) {
         newErrors.name = "Full name is required";
      } else if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
         newErrors.name = "Names must contain character strings only";
      }

      // Email Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim()) {
         newErrors.email = "Email address is required";
      } else if (!emailRegex.test(formData.email)) {
         newErrors.email = "Invalid neural address format";
      }

      // Phone Validation: +CountryCode + 10 digits
      const phoneRegex = /^\+\d{11,14}$/;
      if (!formData.phone.trim()) {
         newErrors.phone = "Contact number is required";
      } else if (!phoneRegex.test(formData.phone)) {
         newErrors.phone = "Required format: +[CountryCode][10 digits]";
      }

      // Password Validation: Strength check
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/;
      if (!formData.password.trim()) {
         newErrors.password = "Security key is required";
      } else if (!passwordRegex.test(formData.password)) {
         newErrors.password = "Min 6 chars: Uppercase, lowercase, numbers & symbols";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      try {
         setIsLoading(true);
         setApiError(null);
         const token = localStorage.getItem('token');

         const payload = {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            role: formData.role,
            profile_image: formData.profile_image
         };

         const response = await axios.post(`${API_URL}/providers`, payload, {
            headers: { Authorization: `Bearer ${token}` }
         });

         onAdd(response.data);
         setFormData({
            name: '', email: '', phone: '', password: '',
            role: 'provider', profile_image: ''
         });
         setImagePreview(null);
         onClose();
      } catch (error: any) {
         console.error('Error creating provider:', error);
         setApiError(error.response?.data?.message || 'Failed to create provider profile');
      } finally {
         setIsLoading(false);
      }
   };

   if (!mounted || !isOpen) return null;

   return createPortal(
      <AnimatePresence>
         <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={onClose}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto"
            >
               <div className="px-8 pt-6 pb-2 flex justify-between items-center">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">Invite Service Expert</h2>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-400" />
                  </button>
               </div>

               <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
                  {apiError && (
                     <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-2">
                        <ShieldCheck size={16} className="shrink-0" />
                        {apiError}
                     </div>
                  )}
                  <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4 relative group">
                     <div className="absolute inset-0 rounded-[2rem] overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                           <UserPlus size={120} />
                        </div>
                     </div>

                     <div className="space-y-4 relative z-10">
                        {/* Profile Image Upload */}
                        <div className="flex flex-col items-center gap-3 mb-6">
                           <label className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                              Profile Identity
                           </label>
                           <div className="relative group/avatar">
                              <div className={`w-24 h-24 rounded-3xl bg-white border ${errors.profile_image ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} shadow-sm overflow-hidden flex items-center justify-center relative cursor-pointer hover:border-blue-200 transition-all`}>
                                 {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                 ) : (
                                    <UserIcon size={32} className="text-gray-300" />
                                 )}
                                 <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                 />
                              </div>
                              <div className={`absolute -bottom-2 -right-2 ${errors.profile_image ? 'bg-red-600' : 'bg-blue-600'} text-white p-2 rounded-xl shadow-lg pointer-events-none transition-colors`}>
                                 <UserPlus size={12} />
                              </div>
                           </div>
                           {errors.profile_image && <p className="text-[9px] font-bold text-red-500 mt-1 uppercase tracking-widest">{errors.profile_image}</p>}
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                              <UserIcon size={12} className="text-blue-500" /> Full Name
                           </label>
                           <input
                              type="text"
                              placeholder="e.g. Rahul Sharma"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className={`w-full px-4 py-3 bg-white border ${errors.name ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                           />
                           {errors.name && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.name}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <Mail size={12} className="text-blue-500" /> Email Access
                              </label>
                              <input
                                 type="email"
                                 placeholder="rahul@nexus.com"
                                 value={formData.email}
                                 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                              />
                              {errors.email && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.email}</p>}
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <Phone size={12} className="text-blue-500" /> Contact Link
                              </label>
                              <input
                                 type="tel"
                                 placeholder="+919876543210"
                                 value={formData.phone}
                                 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.phone ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                              />
                              {errors.phone && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.phone}</p>}
                           </div>
                        </div>

                        <div className="space-y-4">
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <ShieldCheck size={12} className="text-blue-500" /> Password
                                 </label>
                                 <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`w-full px-4 py-3 bg-white border ${errors.password ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                                 />
                                 {errors.password && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest leading-tight">{errors.password}</p>}
                              </div>

                           </div>

                        </div>
                     </div>
                  </div>

                  <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 border-dashed">
                     <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                           <ShieldCheck size={14} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-blue-900 tracking-widest">Verification Protocol</p>
                           <p className="text-[10px] font-bold text-blue-600 leading-relaxed mt-1">Experts will use these credentials to log in. Their access is restricted to "Pending" status until verification.</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                     <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                     >
                        Cancel Entry
                     </button>
                     <button
                        type="submit"
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                     >
                        <Save size={14} /> Send Invitation
                     </button>
                  </div>
               </form>
            </motion.div>
         </div>
      </AnimatePresence>,
      document.body
   );
};

export default InviteExpertModal;
