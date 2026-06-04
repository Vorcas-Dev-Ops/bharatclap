"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  User, 
  CreditCard, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Camera,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import axios from "axios";
import { API_URL } from "@/config/api";

interface ProviderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess?: () => void;
}

const STEPS = [
  { id: 1, title: "Basic Details", icon: User },
  { id: 2, title: "Bank Details", icon: CreditCard },
  { id: 3, title: "Identity & Skills", icon: ShieldCheck },
];

export default function ProviderProfileModal({ isOpen, onClose, onUpdateSuccess }: ProviderProfileModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    gender: "",
    profile_image: "",
    aadhar_id: "",
    bank_details: {
      account_holder_name: "",
      account_number: "",
      ifsc_code: "",
      bank_name: "",
      branch: ""
    },
    verification_docs: {
      id_proof_url: ""
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetchProfile();
    }
  }, [isOpen]);

  const fetchProfile = async () => {
    try {
      setFetching(true);
      const token = localStorage.getItem("token");
      
      // Fetch User & Provider data
      const [userRes, providerRes] = await Promise.all([
        axios.get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/providers/me`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const user = userRes.data;
      const provider = providerRes.data;

      setFormData({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        gender: user.gender || "",
        profile_image: user.profile_image || "",
        aadhar_id: "", // Don't show hashed data
        bank_details: {
          account_holder_name: provider.bank_details?.account_holder_name || "",
          account_number: "", // Don't show last4
          ifsc_code: provider.bank_details?.ifsc_code || "",
          bank_name: provider.bank_details?.bank_name || "",
          branch: provider.bank_details?.branch || ""
        },
        verification_docs: {
          id_proof_url: provider.verification_docs?.id_proof_url || ""
        }
      });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...(prev as any)[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    // Mock upload for now
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (field === 'profile_image') {
          setFormData(prev => ({ ...prev, profile_image: reader.result as string }));
        } else {
          setFormData(prev => ({
            ...prev,
            verification_docs: { id_proof_url: reader.result as string }
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");

      // Update User details
      await axios.put(`${API_URL}/users/me`, {
        name: formData.name,
        gender: formData.gender,
        profile_image: formData.profile_image
      }, { headers: { Authorization: `Bearer ${token}` } });

      // Update Provider details
      await axios.put(`${API_URL}/providers/me`, {
        bank_details: formData.bank_details,
        aadhar_id: formData.aadhar_id,
        verification_docs: formData.verification_docs
      }, { headers: { Authorization: `Bearer ${token}` } });

      onUpdateSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#1D2B83] p-8 text-white">
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
          
          <h2 className="text-2xl font-black tracking-tight uppercase">Update Profile</h2>
          <p className="text-blue-100/70 text-xs font-bold mt-1 uppercase tracking-widest">Complete your professional identity</p>
          
          {/* Breadcrumb / Stepper */}
          <div className="flex items-center gap-4 mt-8">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isActive = currentStep === step.id;
              
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 border-2 ${
                      isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' :
                      isActive ? 'bg-white border-white text-[#1D2B83] shadow-lg shadow-white/20' :
                      'bg-transparent border-white/20 text-white/40'
                    }`}>
                      {isCompleted ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-white/40'}`}>
                      {step.title}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-0.5 w-12 rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-white/10'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {fetching ? (
            <div className="h-96 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching Registry...</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6 mb-8">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-[2rem] bg-slate-50 border-2 border-slate-100 overflow-hidden shadow-inner">
                          <img 
                            src={formData.profile_image || `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <label className="absolute -bottom-2 -right-2 p-2 bg-white rounded-xl shadow-lg border border-slate-100 cursor-pointer hover:scale-110 transition-all text-primary">
                          <Camera size={16} />
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'profile_image')} />
                        </label>
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 uppercase">Personal Image</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">This will be visible to your customers</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                        <input 
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                        <select 
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email (Read Only)</label>
                      <input 
                        type="email"
                        value={formData.email}
                        readOnly
                        className="w-full px-5 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-400 cursor-not-allowed"
                      />
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Holder Name</label>
                      <input 
                        type="text"
                        name="bank_details.account_holder_name"
                        value={formData.bank_details.account_holder_name}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
                      <input 
                        type="password"
                        name="bank_details.account_number"
                        value={formData.bank_details.account_number}
                        onChange={handleInputChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Enter full account number"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IFSC Code</label>
                        <input 
                          type="text"
                          name="bank_details.ifsc_code"
                          value={formData.bank_details.ifsc_code}
                          onChange={handleInputChange}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bank Name</label>
                        <input 
                          type="text"
                          name="bank_details.bank_name"
                          value={formData.bank_details.bank_name}
                          onChange={handleInputChange}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Aadhar Number (12 Digits)</label>
                      <input 
                        type="text"
                        name="aadhar_id"
                        value={formData.aadhar_id}
                        onChange={handleInputChange}
                        maxLength={12}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="0000 0000 0000"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Proof Document</label>
                      <label className="block p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center cursor-pointer hover:bg-slate-100 transition-all group">
                        <Upload className="h-10 w-10 mx-auto text-slate-300 group-hover:text-primary mb-3" />
                        <div className="space-y-1">
                           <p className="text-[10px] font-black text-slate-900 uppercase">
                              {formData.verification_docs.id_proof_url ? 'Document Attached' : 'Upload ID Proof'}
                           </p>
                           <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Aadhar, Voter ID, or Passport (Image/PDF)</p>
                        </div>
                        <input type="file" className="hidden" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'id_proof_url')} />
                      </label>
                    </div>

                    {error && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
                        <AlertCircle size={18} />
                        <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button 
            disabled={currentStep === 1 || loading}
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="flex items-center gap-2 px-6 py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest hover:text-slate-600 disabled:opacity-0 transition-all"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          
          {currentStep < 3 ? (
            <button 
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="flex items-center gap-2 px-8 py-3 bg-[#1D2B83] text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-blue-900/20 hover:scale-105 transition-all"
            >
              Next Step <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : "Update Profile"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
