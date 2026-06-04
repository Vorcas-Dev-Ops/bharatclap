"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Mail, Phone, Shield, User as UserIcon, Save, RefreshCcw } from 'lucide-react';

interface AddUserModalProps {
   isOpen: boolean;
   onClose: () => void;
   onAdd: (user: any) => void;
}

const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onAdd }) => {
   const [formData, setFormData] = useState({
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'customer',
      profile_image: ''
   });
   const [imagePreview, setImagePreview] = useState<string | null>(null);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [loading, setLoading] = useState(false);
   const [mounted, setMounted] = useState(false);

   React.useEffect(() => {
      setMounted(true);
      if (isOpen) {
         // Force registry data reset upon entry
         setFormData({ name: '', email: '', phone: '', password: '', role: 'customer', profile_image: '' });
         setImagePreview(null);
         setErrors({});
         document.body.style.overflow = 'hidden';
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

      // Presence Check
      if (!formData.name.trim()) newErrors.name = "Full name is required";
      if (!formData.email.trim()) newErrors.email = "Email address is required";
      if (!formData.phone.trim()) newErrors.phone = "Contact number is required";
      if (!formData.password.trim()) newErrors.password = "Security key is required";
      //  if (!formData.profile_image) newErrors.profile_image = "Profile image is mandatory";

      if (Object.keys(newErrors).length > 0) {
         setErrors(newErrors);
         return false;
      }

      // Name Validation: Characters only
      if (!/^[a-zA-Z\s]+$/.test(formData.name)) {
         newErrors.name = "Names must contain character strings only";
      }

      // Email Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
         newErrors.email = "Invalid neural address format";
      }

      // Phone Validation: +CountryCode + 10 digits
      const phoneRegex = /^\+\d{11,14}$/;
      if (!phoneRegex.test(formData.phone)) {
         newErrors.phone = "Required format: +[CountryCode][10 digits]";
      }

      // Password Validation: Min 6, upper, lower, symbol, digit
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,}$/;
      if (!passwordRegex.test(formData.password)) {
         newErrors.password = "Min 6 chars: must include Uppercase,lowercase,numbers and symbols (@$!%*?&#)";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
         await onAdd(formData);
         setFormData({ name: '', email: '', phone: '', password: '', role: 'customer', profile_image: '' });
         setImagePreview(null);
         setErrors({});
         onClose();
      } catch (error) {
         console.error('Error adding user:', error);
      } finally {
         setLoading(false);
      }
   };

   if (!mounted || !isOpen) return null;

   return createPortal(
      <AnimatePresence>
         <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
            {/* Backdrop */}
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={onClose}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            />

            {/* Modal Content */}
            <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] overflow-y-auto"
            >
               {/* Header */}
               <div className="px-8 pt-6 pb-2 flex justify-between items-center bg-white sticky top-0 z-20">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">Onboard New Member</h2>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-400" />
                  </button>
               </div>

               <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
                  {/* Form Section Hub */}
                  <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:scale-110 transition-transform">
                        <UserPlus size={120} />
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
                              required
                              placeholder="e.g. Alexander Pierce"
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
                                 required
                                 placeholder="alex@nexus.com"
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
                                 required
                                 placeholder="+919876543210"
                                 value={formData.phone}
                                 onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.phone ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                              />
                              {errors.phone && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.phone}</p>}
                           </div>
                        </div>

                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                              <Shield size={12} className="text-blue-500" /> Secret Key (Password)
                           </label>
                           <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={formData.password}
                              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                              className={`w-full px-4 py-3 bg-white border ${errors.password ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                           />
                           {errors.password && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest leading-tight">{errors.password}</p>}
                        </div>
                     </div>
                  </div>


                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                     <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-50"
                     >
                        Cancel Entry
                     </button>
                     <button
                        type="submit"
                        disabled={loading}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                     >
                        {loading ? (
                           <RefreshCcw size={14} className="animate-spin" />
                        ) : (
                           <Save size={14} />
                        )}
                        Commit to Registry
                     </button>
                  </div>
               </form>
            </motion.div>
         </div>
      </AnimatePresence>,
      document.body
   );
};

export default AddUserModal;
