"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, Mail, Phone, User as UserIcon, Save, RefreshCcw, MapPin, Activity, UserCheck, Upload, FileText, Eye, Download } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface ProviderDetailsModalProps {
   isOpen: boolean;
   onClose: () => void;
   provider: any;
   onUpdateComplete: () => void;
}

const ProviderDetailsModal: React.FC<ProviderDetailsModalProps> = ({ isOpen, onClose, provider, onUpdateComplete }) => {
   const [activeTab, setActiveTab] = useState<'user' | 'provider'>('user');
   const [loading, setLoading] = useState(false);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [mounted, setMounted] = useState(false);
   const [locations, setLocations] = useState<any[]>([]);
   const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
   const [docLabel, setDocLabel] = useState<string>('document');
   const [downloading, setDownloading] = useState(false);

   // User Fields
   const [userForm, setUserForm] = useState({
      name: '',
      email: '',
      phone: '',
      profile_image: ''
   });
   const [imagePreview, setImagePreview] = useState<string | null>(null);

   // Provider Fields
   const [providerForm, setProviderForm] = useState({
      availability_status: 'offline',
      kyc_status: 'pending',
      aadhar_id: '',
      bank_details: {
         account_holder_name: '',
         account_number: '',
         ifsc_code: '',
         bank_name: '',
         branch: ''
      },
      verification_docs: {
         id_proof_url: ''
      }
   });


   useEffect(() => {
      setMounted(true);
      fetchLocations();
   }, []);

   const fetchLocations = async () => {
      try {
         const response = await axios.get(`${API_URL}/locations`);
         setLocations(response.data);
      } catch (error) {
         console.error('Error fetching locations:', error);
      }
   };

   useEffect(() => {
      if (isOpen && provider) {
         // Populate User
         const u = provider.user_id || {};
         setUserForm({
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            profile_image: u.profile_image || ''
         });
         setImagePreview(u.profile_image || null);

         // Populate Provider
         setProviderForm({
            availability_status: provider.availability_status || 'offline',
            kyc_status: provider.kyc_status || 'pending',
            aadhar_id: provider.aadhar_id || '',
            bank_details: {
               account_holder_name: provider.bank_details?.account_holder_name || '',
               account_number: provider.bank_details?.account_number || '',
               ifsc_code: provider.bank_details?.ifsc_code || '',
               bank_name: provider.bank_details?.bank_name || '',
               branch: provider.bank_details?.branch || ''
            },
            verification_docs: {
               id_proof_url: provider.verification_docs?.id_proof_url || ''
            }
         });



         setErrors({});
         setActiveTab('user');
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = 'unset';
      }
      return () => {
         document.body.style.overflow = 'unset';
      };
   }, [isOpen, provider]);

   const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
            setUserForm({ ...userForm, profile_image: reader.result as string });
            setImagePreview(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const validate = () => {
      const newErrors: Record<string, string> = {};

      if (!userForm.name.trim()) newErrors.name = "Full name is required";
      if (!userForm.email.trim()) newErrors.email = "Email is required";
      if (!userForm.phone.trim()) newErrors.phone = "Phone is required";

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0 && (newErrors.name || newErrors.email || newErrors.phone)) {
         setActiveTab('user');
      } else if (Object.keys(newErrors).length > 0) {
         setActiveTab('provider');
      }

      return Object.keys(newErrors).length === 0;
   };

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validate()) return;

      setLoading(true);
      try {
         const token = localStorage.getItem('token');
         const config = { headers: { Authorization: `Bearer ${token}` } };

         // 1. Update User Details (if we have a user reference)
         if (provider.user_id && provider.user_id._id) {
            await axios.put(`${API_URL}/users/${provider.user_id._id}`, userForm, config);
         }

         // 2. Update Provider Details
         await axios.put(`${API_URL}/providers/${provider._id}`, providerForm, config);

         onUpdateComplete();
      } catch (error: any) {
         console.error('Error updating provider/user details:', error);
         alert(error.response?.data?.message || 'Error updating details');
      } finally {
         setLoading(false);
      }
   };

   const openDocument = (url: string, label = 'document') => {
      setDocPreviewUrl(url);
      setDocLabel(label);
   };

   const handleDownload = async () => {
      if (!docPreviewUrl || downloading) return;
      setDownloading(true);
      try {
         const urlPath = docPreviewUrl.split('?')[0];
         const ext = urlPath.split('.').pop()?.toLowerCase() || 'pdf';
         const shortId = (provider._id || '').slice(-4).toUpperCase();
         const filename = `urban_${shortId}_${docLabel}.${ext}`;

         const response = await fetch(docPreviewUrl);
         const blob = await response.blob();
         const blobUrl = URL.createObjectURL(blob);

         const a = document.createElement('a');
         a.href = blobUrl;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(blobUrl);
      } catch (err) {
         console.error('Download failed:', err);
      } finally {
         setDownloading(false);
      }
   };

   if (!mounted || !isOpen || !provider) return null;

   // PDF Preview Modal
   if (docPreviewUrl) {
      return createPortal(
         <div className="fixed inset-0 z-[99999] flex flex-col">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDocPreviewUrl(null)} />
            {/* Modal */}
            <div className="relative z-10 flex flex-col w-full h-full max-w-4xl mx-auto my-8 rounded-3xl overflow-hidden shadow-2xl">
               {/* Header */}
               <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-blue-50 rounded-xl">
                        <FileText size={18} className="text-blue-600" />
                     </div>
                     <div>
                        <h3 className="text-sm font-black text-gray-900">Document Preview</h3>
                        <p className="text-[10px] text-gray-400 font-medium">ID Proof Verification</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-xs font-bold hover:bg-green-100 transition-all disabled:opacity-50"
                        title={`Download as urban_${(provider._id||'').slice(-4).toUpperCase()}_${docLabel}`}
                     >
                        <Download size={14} />
                        {downloading ? 'Downloading...' : 'Download'}
                     </button>
                     <button
                        onClick={() => setDocPreviewUrl(null)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                     >
                        <X size={18} className="text-gray-400" />
                     </button>
                  </div>
               </div>
               {/* PDF iframe via Google Docs Viewer */}
               <div className="flex-1 bg-gray-100">
                  <iframe
                     src={`https://docs.google.com/viewer?url=${encodeURIComponent(docPreviewUrl)}&embedded=true`}
                     className="w-full h-full border-none"
                     title="Document Preview"
                  />
               </div>
            </div>
         </div>,
         document.body
      );
   }

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
               className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] flex flex-col"
            >
               {/* Header */}
               <div className="px-8 pt-6 pb-4 flex justify-between items-center bg-white sticky top-0 z-20 border-b border-gray-100">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">Refine Expert Details</h2>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                     <X size={20} className="text-gray-400" />
                  </button>
               </div>

               {/* Tabs */}
               <div className="px-8 pt-4 pb-0 bg-gray-50/50">
                  <div className="flex gap-4">
                     <button
                        type="button"
                        onClick={() => setActiveTab('user')}
                        className={`pb-4 px-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'user' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                     >
                        User Identity
                        {activeTab === 'user' && <motion.div layoutId="tabMarker" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                     </button>
                     <button
                        type="button"
                        onClick={() => setActiveTab('provider')}
                        className={`pb-4 px-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'provider' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                     >
                        Professional Specs
                        {activeTab === 'provider' && <motion.div layoutId="tabMarker" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                     </button>
                  </div>
               </div>

               {/* Form Body */}
               <div className="overflow-y-auto px-8 py-6 custom-scrollbar flex-1">
                  <form id="providerUpdateForm" onSubmit={handleSubmit} className="space-y-6">

                     {/* User Identity Tab */}
                     {activeTab === 'user' && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                           <div className="flex flex-col items-center gap-3 mb-6">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest">Visual Identity</label>
                              <div className="relative group/avatar">
                                 <div className={`w-24 h-24 rounded-3xl bg-white border ${errors.profile_image ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} shadow-sm overflow-hidden flex items-center justify-center relative cursor-pointer hover:border-blue-200 transition-all`}>
                                    {imagePreview ? (
                                       <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                       <UserIcon size={32} className="text-gray-300" />
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                 </div>
                                 <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg pointer-events-none">
                                    <Edit size={12} />
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-1">
                              <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                 <UserIcon size={12} className="text-blue-500" /> Full Name
                              </label>
                              <input
                                 type="text"
                                 value={userForm.name}
                                 onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                                 className={`w-full px-4 py-3 bg-white border ${errors.name ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                              />
                              {errors.name && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.name}</p>}
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <Mail size={12} className="text-blue-500" /> Email Access
                                 </label>
                                 <input
                                    type="email"
                                    value={userForm.email}
                                    onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
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
                                    value={userForm.phone}
                                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                                    className={`w-full px-4 py-3 bg-white border ${errors.phone ? 'border-red-500 ring-4 ring-red-500/10' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all`}
                                 />
                                 {errors.phone && <p className="text-[9px] font-bold text-red-500 ml-2 mt-1 uppercase tracking-widest">{errors.phone}</p>}
                              </div>
                           </div>
                        </motion.div>
                     )}

                     {/* Provider Specs Tab */}
                     {activeTab === 'provider' && (
                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                           <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <Activity size={12} className="text-blue-500" /> Availability
                                 </label>
                                 <select
                                    value={providerForm.availability_status}
                                    onChange={(e) => setProviderForm({ ...providerForm, availability_status: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                 >
                                    <option value="available">Available</option>
                                    <option value="busy">Busy</option>
                                    <option value="offline">Offline</option>
                                 </select>
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <UserCheck size={12} className="text-blue-500" /> KYC Status
                                 </label>
                                 <select
                                    value={providerForm.kyc_status}
                                    onChange={(e) => setProviderForm({ ...providerForm, kyc_status: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                 >
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                    <option value="rejected">Rejected</option>
                                 </select>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <Activity size={12} className="text-blue-500" /> Aadhar ID
                                 </label>
                                 <input
                                    type="text"
                                    value={providerForm.aadhar_id}
                                    onChange={(e) => setProviderForm({ ...providerForm, aadhar_id: e.target.value })}
                                    className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                    placeholder="Aadhar Number"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                                    <FileText size={12} className="text-blue-500" /> ID Proof Document
                                 </label>
                                 <div className="flex gap-2 relative group/upload">
                                    <div className={`flex-1 px-4 py-3 bg-white border ${providerForm.verification_docs.id_proof_url ? 'border-green-200 bg-green-50/30' : 'border-gray-100'} rounded-2xl text-xs font-bold text-gray-700 flex items-center justify-between transition-all group-hover/upload:border-blue-200`}>
                                       <span className="truncate max-w-[150px]">
                                          {providerForm.verification_docs.id_proof_url ? 'Document Ready' : 'Select ID Proof'}
                                       </span>
                                       <Upload size={14} className="text-gray-400 group-hover/upload:text-blue-600" />
                                       <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          onChange={(e) => {
                                             const file = e.target.files?.[0];
                                             if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                   setProviderForm({ 
                                                      ...providerForm, 
                                                      verification_docs: { id_proof_url: reader.result as string } 
                                                   });
                                                };
                                                reader.readAsDataURL(file);
                                             }
                                          }}
                                          className="absolute inset-0 opacity-0 cursor-pointer"
                                       />
                                    </div>
                                    {providerForm.verification_docs.id_proof_url && !providerForm.verification_docs.id_proof_url.startsWith('data:') && (
                                       <button
                                          type="button"
                                          onClick={() => openDocument(providerForm.verification_docs.id_proof_url, 'national_id')}
                                          className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all flex items-center justify-center shadow-sm"
                                          title="Preview Document"
                                       >
                                          <Eye size={16} />
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>

                           <div className="space-y-3 pt-4 border-t border-gray-100">
                              <h3 className="text-sm font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">Bank Details</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Account Holder</label>
                                    <input
                                       type="text"
                                       value={providerForm.bank_details.account_holder_name}
                                       onChange={(e) => setProviderForm({ ...providerForm, bank_details: { ...providerForm.bank_details, account_holder_name: e.target.value } })}
                                       className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                       placeholder="Account Holder Name"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Account Number</label>
                                    <input
                                       type="text"
                                       value={providerForm.bank_details.account_number}
                                       onChange={(e) => setProviderForm({ ...providerForm, bank_details: { ...providerForm.bank_details, account_number: e.target.value } })}
                                       className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                       placeholder="Account Number"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">IFSC Code</label>
                                    <input
                                       type="text"
                                       value={providerForm.bank_details.ifsc_code}
                                       onChange={(e) => setProviderForm({ ...providerForm, bank_details: { ...providerForm.bank_details, ifsc_code: e.target.value } })}
                                       className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                       placeholder="IFSC Code"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Bank Name</label>
                                    <input
                                       type="text"
                                       value={providerForm.bank_details.bank_name}
                                       onChange={(e) => setProviderForm({ ...providerForm, bank_details: { ...providerForm.bank_details, bank_name: e.target.value } })}
                                       className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                       placeholder="Bank Name"
                                    />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1">Branch</label>
                                    <input
                                       type="text"
                                       value={providerForm.bank_details.branch}
                                       onChange={(e) => setProviderForm({ ...providerForm, bank_details: { ...providerForm.bank_details, branch: e.target.value } })}
                                       className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                                       placeholder="Branch"
                                    />
                                 </div>
                              </div>
                           </div>
                        </motion.div>
                     )}
                  </form>
               </div>

               {/* Footer */}
               <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <button
                     type="button"
                     onClick={onClose}
                     disabled={loading}
                     className="flex-1 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                     Abort Changes
                  </button>
                  <button
                     form="providerUpdateForm"
                     type="submit"
                     disabled={loading}
                     className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                     {loading ? (
                        <RefreshCcw size={14} className="animate-spin" />
                     ) : (
                        <Save size={14} />
                     )}
                     Deploy Updates
                  </button>
               </div>

            </motion.div>
         </div>
      </AnimatePresence>,
      document.body
   );
};

export default ProviderDetailsModal;
