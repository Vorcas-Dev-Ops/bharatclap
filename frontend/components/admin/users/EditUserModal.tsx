"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, Mail, Phone, Shield, User as UserIcon, Save, RefreshCcw, UserCheck } from 'lucide-react';

interface EditUserModalProps {
   isOpen: boolean;
   onClose: () => void;
   onUpdate: (id: string, userData: any) => void;
   user: any;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onUpdate, user }) => {
   const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      password: '',
      status: 'Active',
      profile_image: ''
   });
   const [imagePreview, setImagePreview] = useState<string | null>(null);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [loading, setLoading] = useState(false);
   const [mounted, setMounted] = useState(false);

   useEffect(() => {
      setMounted(true);
   }, []);

   useEffect(() => {
      if (isOpen && user) {
         setFormData({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            password: '', // Leave empty unless resetting
            status: user.status || 'Active',
            profile_image: user.avatar || ''
         });
         setImagePreview(user.avatar || null);
         setErrors({});
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = 'unset';
      }
      return () => {
         document.body.style.overflow = 'unset';
      };
   }, [isOpen, user]);

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
         newErrors.email = "Invalid format: e.g. name@domain.com";
      }

      // Phone Validation: +CountryCode + 10 digits
      const phoneRegex = /^\+\d{11,14}$/;
      if (!formData.phone.trim()) {
         newErrors.phone = "Contact number is required";
      } else if (!phoneRegex.test(formData.phone)) {
         newErrors.phone = "Required: +[CountryCode][10 digits]";
      }

      // Password Validation: Strength Check
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/;
      if (formData.password.trim() && !passwordRegex.test(formData.password)) {
         newErrors.password = "Min 6 chars: Uppercase, lowercase, number & symbol";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
         // Only send password if it's been touched
         const payload = { ...formData };
         if (!payload.password) delete (payload as any).password;

         await onUpdate(user.id, payload);
         onClose();
      } catch (error) {
         console.error('Error updating user:', error);
      } finally {
         setLoading(false);
      }
   };

   if (!mounted || !isOpen || !user) return null;

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
               className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] overflow-y-auto"
            >
               <div className="px-8 pt-6 pb-2 flex justify-between items-center bg-white sticky top-0 z-20">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">Refine User Portfolio</h2>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-400" />
                  </button>
               </div>

               <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
                  <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                        <Edit size={120} />
                     </div>

                     <div className="space-y-4 relative z-10">
                        <div className="flex flex-col items-center gap-3 mb-6">
                           <label className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                              Visual Identity
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
                              <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-2 rounded-xl shadow-lg pointer-events-none">
                                 <Edit size={12} />
                              </div>
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                              <UserIcon size={12} className="text-amber-500" /> Full Name
                           </label>
                           <input
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              className={`w-full px-4 py-3 bg-white border ${errors.name ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 transition-all`}
                           />
                           {errors.name && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.name}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <Mail size={12} className="text-amber-500" /> Email Access
                              </label>
                              <input
                                 type="email"
                                 value={formData.email}
                                 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.email ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 transition-all`}
                              />
                              {errors.email && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.email}</p>}
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <Phone size={12} className="text-amber-500" /> Contact Link
                              </label>
                              <input
                                 type="tel"
                                 value={formData.phone}
                                 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.phone ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 transition-all`}
                              />
                              {errors.phone && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.phone}</p>}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <Shield size={12} className="text-amber-500" /> Reset Password
                              </label>
                              <input
                                 type="password"
                                 placeholder="•••••••• (Security Strength Check)"
                                 value={formData.password}
                                 onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.password ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 transition-all`}
                              />
                              {errors.password && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest leading-tight">{errors.password}</p>}
                           </div>
                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <UserCheck size={12} className="text-amber-500" /> Account Status
                              </label>
                              <select
                                 value={formData.status}
                                 onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                 className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-700 focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-200 transition-all appearance-none"
                              >
                                 <option value="Active">Active</option>
                                 <option value="Blocked">Blocked</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                     <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
                     >
                        Abort Changes
                     </button>
                     <button
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {loading ? (
                           <RefreshCcw size={14} className="animate-spin" />
                        ) : (
                           <Save size={14} />
                        )}
                        Sync Changes
                     </button>
                  </div>
               </form>
            </motion.div>
         </div>
      </AnimatePresence>,
      document.body
   );
};

export default EditUserModal;
