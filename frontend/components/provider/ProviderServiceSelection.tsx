"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, Plus, Minus, Home, Brush, Hammer, Zap, Trees, Monitor,
  User as UserIcon, Package, GraduationCap, ChevronLeft, ChevronRight,
  ArrowLeft, Upload, FileText, IndianRupee, Briefcase, Award, Camera,
  ShieldCheck, Landmark, CreditCard, Lock, Clock, MapPin, Calendar, Info,
  UserCircle, Contact2
} from "lucide-react";
import { API_URL } from '@/config/api';
import CelebrationModal from "@/components/common/CelebrationModal";
import { lookupRazorpayIfsc } from "@/utils/razorpayIfsc";

interface Category {
  _id: string;
  category_name: string;
  icon: string;
  description: string;
  requiresGenderSelection: boolean;
}

interface Service {
  _id: string;
  service_name: string;
  category_id: string;
  genderApplicability?: 'men' | 'women';
}

interface LocationData {
  _id: string;
  name: string;
  type: string;
}


interface ServiceDetail {
  experience: number | null;
  price: number | null;
  subserviceIds: string[];
  selectedLocations: string[];
  documents: DocUpload[];
}

interface DocUpload {
  doc_type: string;
  file?: File;
  file_url?: string;
}


export default function ProviderServiceSelection() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [servicesMap, setServicesMap] = useState<Record<string, Service[]>>({});
  const [subServicesMap, setSubServicesMap] = useState<Record<string, any[]>>({});
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [categoryGenders, setCategoryGenders] = useState<Record<string, 'men' | 'women'>>({});

  // Steps: 0 (Categories), 1 (Services), 2 (Prof. Details), 3 (Identity & Bank)
  const [currentStep, setCurrentStep] = useState(0);

  // Step 2 form states
  const [serviceDetails, setServiceDetails] = useState<Record<string, ServiceDetail>>({});

  // Step 3 form states
  const [aadharId, setAadharId] = useState("");
  const [idProof, setIdProof] = useState<DocUpload>({ doc_type: 'Government ID' });
  const [bankDetails, setBankDetails] = useState({
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    bank_name: "",
    branch: ""
  });
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscVerified, setIfscVerified] = useState(false);

  const handleIfscCodeChange = async (value: string) => {
    const cleanIfsc = value.trim().toUpperCase();
    setBankDetails(prev => ({ ...prev, ifsc_code: cleanIfsc }));
    if (error) setError("");

    if (cleanIfsc.length === 11) {
      setIfscLoading(true);
      const res = await lookupRazorpayIfsc(cleanIfsc);
      setIfscLoading(false);
      if (res) {
        setBankDetails(prev => ({
          ...prev,
          ifsc_code: cleanIfsc,
          bank_name: res.bankName,
          branch: res.branch
        }));
        setIfscVerified(true);
      } else {
        setIfscVerified(false);
      }
    } else {
      setIfscVerified(false);
    }
  };

  // Carousel state for categories
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;
  const totalPages = Math.ceil(categories.length / itemsPerPage);

  useEffect(() => {
    setError("");
  }, [currentStep]);

  useEffect(() => {
    const storedUserStr = localStorage.getItem("user");
    if (!storedUserStr) {
      router.push("/signup");
      return;
    }
    setUser(JSON.parse(storedUserStr));

    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${API_URL}/providers/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) {
            fetchCategories();
            fetchLocations();
            return;
          }

          // Route based on onboarding_status
          const status = data.onboarding_status;
          if (status === 'APPROVED') {
            router.replace("/provider/dashboard");
            return;
          }
          if (status === 'UNDER_REVIEW') {
            router.replace("/provider/pending");
            return;
          }
          if (status === 'ACTION_REQUIRED') {
            router.replace("/provider/pending");
            return;
          }

          // DRAFT or undefined — show wizard, pre-populate from saved data

          // Pre-populate wizard state from onboarding_draft (category/service selections)
          const draft = data.onboarding_draft;
          if (draft) {
            if (draft.selected_category_ids?.length) setSelectedCategoryIds(draft.selected_category_ids);
            if (draft.selected_services?.length) setSelectedServices(draft.selected_services);
            if (draft.service_details) setServiceDetails(draft.service_details);
            if (draft.category_genders) setCategoryGenders(draft.category_genders);
          }

          // Pre-populate identity/bank from saved provider data
          if (data.aadhar_last4) {
            setAadharId("XXXXXXXX" + data.aadhar_last4);
          }
          if (data.bank_details) {
            const bd = data.bank_details;
            setBankDetails(prev => ({
              ...prev,
              account_holder_name: bd.account_holder_name || prev.account_holder_name,
              ifsc_code: bd.ifsc_code || prev.ifsc_code,
              bank_name: bd.bank_name || prev.bank_name,
              branch: bd.branch || prev.branch,
            }));
            if (bd.ifsc_code) setIfscVerified(true);
          }

          // Resume from last saved step
          const savedStep = data.onboarding_step || 0;
          if (savedStep > 0) setCurrentStep(savedStep);

          fetchCategories();
          fetchLocations();
        })
        .catch(() => {
          fetchCategories();
          fetchLocations();
        });
    } else {
      fetchCategories();
      fetchLocations();
    }
  }, [router]);

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/categories`);
      const data = await res.json();
      if (res.ok) setCategories(data);
    } catch (err) {
      console.error("Failed to fetch categories", err);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${API_URL}/locations`);
      const data = await res.json();
      if (res.ok) {
        setLocations(data.filter((l: any) => l.status === 'active' && l.type?.toLowerCase() === 'area'));
      }
    } catch (err) {
      console.error("Failed to fetch locations", err);
    }
  };

  const fetchServicesForCategory = async (categoryId: string) => {
    if (servicesMap[categoryId]) return;
    try {
      const res = await fetch(`${API_URL}/services?category_id=${categoryId}`);
      const data = await res.json();
      if (res.ok) {
        setServicesMap(prev => ({ ...prev, [categoryId]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch services", err);
    }
  };

  const fetchSubServicesForService = async (serviceId: string) => {
    if (subServicesMap[serviceId]) return;
    try {
      const res = await fetch(`${API_URL}/sub-services?service_id=${serviceId}`);
      const data = await res.json();
      if (res.ok) {
        setSubServicesMap(prev => ({ ...prev, [serviceId]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch sub-services", err);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      const isSelected = prev.includes(categoryId);
      if (isSelected) {
        setSelectedServices([]);
        return [];
      } else {
        fetchServicesForCategory(categoryId);
        setSelectedServices([]); // Clear services since category is changing
        return [categoryId];
      }
    });
  };


  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const isSelected = prev.includes(serviceId);
      const next = isSelected ? prev.filter(id => id !== serviceId) : [...prev, serviceId];
      if (!isSelected && !serviceDetails[serviceId]) {
        fetchSubServicesForService(serviceId);
        setServiceDetails(curr => ({
          ...curr,
          [serviceId]: {
            experience: null,
            price: null,
            subserviceIds: [],
            selectedLocations: [],
            availability: [],
            documents: []
          }
        }));
      }
      return next;
    });
  };

  const handleServiceDetailChange = (serviceId: string, field: keyof ServiceDetail, value: any) => {
    setServiceDetails(prev => ({
      ...prev,
      [serviceId]: { ...prev[serviceId], [field]: value }
    }));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const saveDraft = async (nextStep: number, customDraft?: any) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const draftPayload = customDraft || {
        selected_category_ids: selectedCategoryIds,
        selected_services: selectedServices,
        service_details: serviceDetails,
        category_genders: categoryGenders,
      };
      await fetch(`${API_URL}/providers/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          onboarding_step: nextStep,
          onboarding_draft: draftPayload,
        })
      });
    } catch (err) {
      console.error("Failed to save draft progress:", err);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 0) {
      if (selectedCategoryIds.length === 0) return setError("Please select at least one category.");
      saveDraft(1, {
        selected_category_ids: selectedCategoryIds,
        selected_services: selectedServices,
        service_details: serviceDetails,
        category_genders: categoryGenders,
      });
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (selectedServices.length === 0) return setError("Please select at least one service.");

      const validCategoryIds = selectedCategoryIds.filter(catId => {
        const catServices = servicesMap[catId] || [];
        return catServices.some(svc => selectedServices.includes(svc._id));
      });

      if (validCategoryIds.length === 0) {
        return setError("Please select at least one service for your categories.");
      }

      setSelectedCategoryIds(validCategoryIds);

      // Fetch sub-services for all selected services
      selectedServices.forEach(svcId => {
        fetchSubServicesForService(svcId);
      });

      saveDraft(2, {
        selected_category_ids: validCategoryIds,
        selected_services: selectedServices,
        service_details: serviceDetails,
        category_genders: categoryGenders,
      });
      setCurrentStep(2);
    } else if (currentStep === 2) {
      for (const svcId of selectedServices) {
        const details = serviceDetails[svcId];
        const service = Object.values(servicesMap).flat().find(s => s._id === svcId);

        if (!details || details.experience === null || details.experience === undefined) {
          return setError(`Please enter years of experience for ${service?.service_name}.`);
        }
        if (!details || !details.price) {
          return setError(`Please enter a valid price for ${service?.service_name}.`);
        }
        if (!details.selectedLocations || details.selectedLocations.length === 0) {
          return setError(`Please select at least one location for ${service?.service_name}.`);
        }
        if (!details.subserviceIds || details.subserviceIds.length === 0) {
          return setError(`Please select at least one sub-service for ${service?.service_name}.`);
        }
      }
      saveDraft(3, {
        selected_category_ids: selectedCategoryIds,
        selected_services: selectedServices,
        service_details: serviceDetails,
        category_genders: categoryGenders,
      });
      setCurrentStep(3);
    }
    setError("");
  };

  const handleSubmit = async () => {
    // Step 3 Validation: Identity and Bank Details
    if (!idProof.file && !idProof.file_url) return setError("Please upload your ID Proof (Government ID).");

    const aadharRegex = /^\d{12}$/;
    if (!aadharRegex.test(aadharId.replace(/\s/g, ""))) {
      return setError("Please enter a valid 12-digit Aadhar Number.");
    }

    if (!bankDetails.account_holder_name.trim()) return setError("Account Holder Name is required.");
    if (!bankDetails.account_number.trim() || bankDetails.account_number.length < 9) {
      return setError("Please enter a valid Bank Account Number.");
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankDetails.ifsc_code.toUpperCase())) {
      return setError("Please enter a valid 11-digit IFSC Code (e.g., ABCD0123456).");
    }

    if (!bankDetails.bank_name.trim()) return setError("Bank Name is required.");
    if (!bankDetails.branch.trim()) return setError("Bank Branch is required.");

    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      // 1. Get Provider ID
      const pRes = await fetch(`${API_URL}/providers/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.message || "Failed to find provider profile");
      const providerId = pData._id;

      // 2. Update Identity Details via /me endpoint
      const base64IdProof = idProof.file ? await fileToBase64(idProof.file) : (idProof.file_url || "");
      
      const updateMeRes = await fetch(`${API_URL}/providers/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          aadhar_id: aadharId,
          bank_details: bankDetails,
          verification_docs: {
            id_proof_url: base64IdProof,
            selfie_url: ""
          }
        }),
      });
      if (!updateMeRes.ok) {
        const errorData = await updateMeRes.json();
        throw new Error(errorData.message || "Failed to update identity and bank details.");
      }

      for (const serviceId of selectedServices) {
        const service = Object.values(servicesMap).flat().find(s => s._id === serviceId);
        const details = serviceDetails[serviceId] || {};

        // Convert service documents to base64
        const processedDocs = await Promise.all((details.documents || []).map(async (doc: any) => {
          if (doc.file) {
            const base64 = await fileToBase64(doc.file);
            return { ...doc, file_url: base64 };
          }
          return doc;
        }));

        const psRes = await fetch(`${API_URL}/provider-services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            provider_id: providerId,
            experience: details.experience || 0,
            price: details.price || 0,
            subservice_ids: details.subserviceIds || [],
            location_ids: details.selectedLocations || [],
            documents: processedDocs.map((d: any) => ({
              doc_type: d.doc_type,
              file_url: d.file_url || ""
            }))
          }),
        });

        if (!psRes.ok) {
          const errorData = await psRes.json();
          throw new Error(errorData.message || `Failed to register ${service?.service_name}.`);
        }
      }

      // 3. Formally Submit Application for Admin Review
      const submitRes = await fetch(`${API_URL}/providers/me/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!submitRes.ok) {
        const submitErr = await submitRes.json();
        throw new Error(submitErr.message || "Failed to submit application for review.");
      }

      setIsSuccessOpen(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSuccess = () => {
    setIsSuccessOpen(false);
    router.push("/provider/pending");
  };

  const getIcon = (iconName: string) => {
    const iconClass = "w-4 h-4";
    switch (iconName.toLowerCase()) {
      case 'home': return <Home className={iconClass} />;
      case 'brush': return <Brush className={iconClass} />;
      case 'hammer': return <Hammer className={iconClass} />;
      case 'zap': return <Zap className={iconClass} />;
      case 'trees': return <Trees className={iconClass} />;
      case 'monitor': return <Monitor className={iconClass} />;
      case 'user': return <UserIcon className={iconClass} />;
      case 'package': return <Package className={iconClass} />;
      case 'graduation': return <GraduationCap className={iconClass} />;
      default: return <Package className={iconClass} />;
    }
  };

  const nextPage = () => { if (currentPage < totalPages - 1) setCurrentPage(prev => prev + 1); };
  const prevPage = () => { if (currentPage > 0) setCurrentPage(prev => prev - 1); };
  const visibleCategories = categories.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-4 py-8">
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full max-w-[420px] bg-white rounded-[2rem] shadow-2xl p-6 sm:p-8 border-t-8 border-[#1D2B83]"
      >
        {/* Stepper */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i < (currentStep === 0 ? 3 : currentStep === 1 ? 4 : currentStep === 2 ? 5 : 5) ? "w-6 bg-[#1D2B83]" : "w-4 bg-slate-100"}`}></div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-2xl font-extrabold text-[#1D2B83] tracking-tight mb-1.5">
            {currentStep === 3 ? "Verify your identity" : currentStep === 0 ? "Choose categories" : currentStep === 1 ? "Refine services" : "Professional details"}
          </h1>
          <p className="text-slate-400 font-medium text-[13px] max-w-[320px] mx-auto leading-relaxed">
            {currentStep === 3
              ? "To maintain our service standards of trust and safety, please provide the following details."
              : currentStep === 0 ? "Select your expertise areas." : currentStep === 1 ? "Pick specific services." : "Provide experience, location & schedule."}
          </p>
        </div>

        {/* Steps Content */}
        <div className="max-h-[340px] overflow-y-auto pr-2 custom-scrollbar space-y-6 mb-6">
          {currentStep === 0 && (
            <div className="relative group px-10">
              <div className="grid grid-cols-3 gap-2.5">
                {visibleCategories.map((cat) => (
                  <button key={cat._id} onClick={() => handleCategoryToggle(cat._id)} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all group min-h-[100px] ${selectedCategoryIds.includes(cat._id) ? "border-[#1D2B83] bg-[#F0F2FF] shadow-sm" : "border-slate-50 bg-[#F5F7FA]"}`}>
                    <div className={`mb-2 p-2.5 rounded-full ${selectedCategoryIds.includes(cat._id) ? "bg-[#1D2B83] text-white" : "bg-white text-[#1D2B83]"}`}>{getIcon(cat.icon)}</div>
                    <span className={`text-[10px] font-bold text-center leading-tight ${selectedCategoryIds.includes(cat._id) ? "text-[#1D2B83]" : "text-slate-600"}`}>{cat.category_name}</span>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <>
                  <button onClick={prevPage} disabled={currentPage === 0} className="absolute left-0 top-1/2 -translate-y-1/2 p-2"><ChevronLeft className="w-5 h-5 text-[#1D2B83]" /></button>
                  <button onClick={nextPage} disabled={currentPage === totalPages - 1} className="absolute right-0 top-1/2 -translate-y-1/2 p-2"><ChevronRight className="w-5 h-5 text-[#1D2B83]" /></button>
                </>
              )}
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              {selectedCategoryIds.map(catId => {
                const category = categories.find(c => c._id === catId);
                const allServices = servicesMap[catId] || [];
                const selectedGender = categoryGenders[catId];
                
                const displayServices = category?.requiresGenderSelection && selectedGender
                   ? allServices.filter(s => s.genderApplicability === selectedGender)
                   : allServices;

                return (
                  <div key={catId} className="space-y-2.5">
                    <div className="flex items-center justify-between pl-1 pr-2">
                      <h4 className="text-[11px] font-bold text-slate-500">{category?.category_name}</h4>
                      <button onClick={() => handleCategoryToggle(catId)} className="p-1 rounded-md bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Minus className="w-3 h-3" /></button>
                    </div>
                    
                    {category?.requiresGenderSelection && (
                      <div className="flex bg-slate-100 p-1 rounded-xl mb-2">
                        <button 
                          onClick={() => setCategoryGenders(prev => ({...prev, [catId]: 'men'}))}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${selectedGender === 'men' ? 'bg-white text-[#1D2B83] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Men
                        </button>
                        <button 
                          onClick={() => setCategoryGenders(prev => ({...prev, [catId]: 'women'}))}
                          className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${selectedGender === 'women' ? 'bg-white text-[#1D2B83] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          Women
                        </button>
                      </div>
                    )}

                    {(!category?.requiresGenderSelection || selectedGender) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {displayServices.map(svc => (
                          <button key={svc._id} onClick={() => toggleService(svc._id)} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 ${selectedServices.includes(svc._id) ? "border-[#1D2B83] bg-[#F0F2FF]" : "border-slate-50 bg-[#F5F7FA]"}`}>
                            <span className="text-[12px] font-bold">{svc.service_name}</span>
                            {selectedServices.includes(svc._id) ? <Check className="w-3.5 h-3.5 text-[#1D2B83]" /> : <Plus className="w-3.5 h-3.5 text-slate-300" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-8">
              {selectedServices.map(serviceId => {
                const service = Object.values(servicesMap).flat().find(s => s._id === serviceId);
                const details = serviceDetails[serviceId] || {
                  experience: 0,
                  price: 0,
                  subserviceIds: [],
                  selectedLocations: [],
                  documents: []
                };
                const subServices = subServicesMap[serviceId] || [];

                return (
                  <div key={serviceId} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100 space-y-6">
                    <div className="flex items-center gap-2 text-[#1D2B83]">
                      <div className="p-1.5 bg-white rounded-lg shadow-sm"><Award className="w-4 h-4" /></div>
                      <h4 className="text-sm font-bold">{service?.service_name}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Experience</label>
                        <input
                          type="number"
                          value={details.experience === null ? "" : details.experience}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseInt(e.target.value);
                            handleServiceDetailChange(serviceId, 'experience', val);
                            if (error) setError("");
                          }}
                          className="w-full px-4 py-2 border rounded-xl text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Price</label>
                        <input
                          type="number"
                          value={details.price === null ? "" : details.price}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value === "" ? null : parseInt(e.target.value);
                            handleServiceDetailChange(serviceId, 'price', val);
                            if (error) setError("");
                          }}
                          className="w-full px-4 py-2 border rounded-xl text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Service Locations</label>
                      <div className="flex flex-wrap gap-2">
                        {locations.map(loc => (
                          <button key={loc._id} onClick={() => {
                            const isSelected = details.selectedLocations.includes(loc._id);
                            handleServiceDetailChange(serviceId, 'selectedLocations', isSelected ? details.selectedLocations.filter(id => id !== loc._id) : [...details.selectedLocations, loc._id]);
                            if (error) setError("");
                          }} className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${details.selectedLocations.includes(loc._id) ? "bg-[#1D2B83] text-white border-[#1D2B83]" : "bg-white text-slate-500 border-slate-200"}`}>
                            {loc.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><Package className="w-3 h-3" /> Select Sub-Services</label>
                      <div className="flex flex-wrap gap-2">
                        {subServices.length > 0 ? subServices.map(sub => (
                          <button
                            key={sub._id}
                            onClick={() => {
                              const isSelected = details.subserviceIds.includes(sub._id);
                              handleServiceDetailChange(serviceId, 'subserviceIds', isSelected ? details.subserviceIds.filter(id => id !== sub._id) : [...details.subserviceIds, sub._id]);
                              if (error) setError("");
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${details.subserviceIds.includes(sub._id) ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                          >
                            <div className="flex items-center gap-1.5">
                              {details.subserviceIds.includes(sub._id) && <Check className="w-3 h-3" />}
                              {sub.subservice_name}
                            </div>
                          </button>
                        )) : (
                          <div className="text-[11px] text-slate-400 italic pl-1">Loading sub-services...</div>
                        )}
                      </div>
                    </div>


                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Experience Certificates <span className="lowercase text-slate-300 font-medium">(Optional)</span></label>
                      <div className="flex flex-wrap gap-2 mb-1">
                        {(details.documents || []).map((doc, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                            <FileText className="w-3.5 h-3.5 text-[#1D2B83]" />
                            <span className="text-[10px] font-medium text-[#1D2B83] truncate max-w-[100px]">{doc.file?.name}</span>
                            <button onClick={() => {
                              const nextDocs = (details.documents || []).filter((_, i) => i !== idx);
                              handleServiceDetailChange(serviceId, 'documents', nextDocs);
                            }}><Minus className="w-3 h-3 text-red-500" /></button>
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center justify-center p-3.5 bg-white border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#1D2B83] transition-all group">
                        <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#1D2B83] mr-2" />
                        <span className="text-[11px] font-bold text-slate-500">Upload Certificate</span>
                        <input type="file" className="hidden" multiple onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const newDocs = files.map(file => ({ doc_type: 'Experience Certificate', file, file_url: URL.createObjectURL(file) }));
                          handleServiceDetailChange(serviceId, 'documents', [...(details.documents || []), ...newDocs]);
                        }} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* ID Proof Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pl-1">
                  <Contact2 className="w-4 h-4 text-[#1D2B83]" />
                  <h3 className="text-[13px] font-bold text-slate-700">ID Proof & Aadhar Verification</h3>
                </div>
                <label className="relative flex flex-col items-center justify-center p-6 bg-[#F8FAFC] border-2 border-dashed border-[#E2E8F0] rounded-[1.5rem] cursor-pointer hover:border-[#1D2B83] hover:bg-[#F0F2FF] transition-all group">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm mb-2 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5 text-[#94A3B8] group-hover:text-[#1D2B83]" />
                  </div>
                  <span className="text-[13px] font-bold text-[#334155]">
                    ID Proof Document <span className="text-red-500 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-[#94A3B8] mt-1">PDF, JPG, or PNG (Max 10MB)</span>
                  {idProof.file && (
                    <div className="mt-3 px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold border border-green-100 flex items-center gap-1.5">
                      <Check className="w-3 h-3" /> {idProof.file.name}
                    </div>
                  )}
                  <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
                    if (file.size > MAX_SIZE) {
                      setError(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Please select a file under 10MB.`);
                      e.target.value = '';
                      return;
                    }
                    setError('');
                    setIdProof({ doc_type: 'ID Proof', file, file_url: URL.createObjectURL(file) });
                  }} />
                </label>
                <div className="space-y-1.5 px-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Aadhar ID Number <span className="text-red-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    value={aadharId}
                    maxLength={12}
                    onChange={(e) => {
                      setAadharId(e.target.value.replace(/\D/g, ''));
                      if (error) setError("");
                    }}
                    className="w-full px-4 py-3 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-mono"
                    placeholder="12 Digit Aadhar Number"
                  />
                </div>
              </div>

              {/* Bank Details Section */}
              <div className="space-y-3 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between pl-1 pr-1">
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-[#1D2B83]" />
                    <h3 className="text-[13px] font-bold text-slate-700">Bank Details</h3>
                  </div>
                  <span className="text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-widest">
                    RazorpayX Direct Payout Active
                  </span>
                </div>

                <div className="space-y-3 px-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Account Holder Name <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankDetails.account_holder_name}
                      onChange={(e) => {
                        setBankDetails({ ...bankDetails, account_holder_name: e.target.value });
                        if (error) setError("");
                      }}
                      className="w-full px-4 py-2.5 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-bold text-slate-800"
                      placeholder="Full name as per bank records"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Account Number <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankDetails.account_number}
                        onChange={(e) => {
                          setBankDetails({ ...bankDetails, account_number: e.target.value.replace(/\D/g, '') });
                          if (error) setError("");
                        }}
                        className="w-full px-4 py-2.5 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-mono"
                        placeholder="Account Number"
                      />
                      {bankDetails.account_number.length >= 9 && bankDetails.account_holder_name && (
                        <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3 text-emerald-500" /> Account Holder: {bankDetails.account_holder_name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        IFSC Code <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankDetails.ifsc_code}
                        maxLength={11}
                        onChange={(e) => handleIfscCodeChange(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-mono uppercase"
                        placeholder="e.g. SBIN0000123"
                      />
                      {ifscLoading && (
                        <p className="text-[10px] text-blue-500 font-bold mt-1">Looking up RazorpayX IFSC...</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Bank Name <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankDetails.bank_name}
                        onChange={(e) => {
                          setBankDetails({ ...bankDetails, bank_name: e.target.value });
                          if (error) setError("");
                        }}
                        className="w-full px-4 py-2.5 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-semibold text-slate-700"
                        placeholder="Auto-filled via IFSC"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Branch <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="text"
                        value={bankDetails.branch}
                        onChange={(e) => {
                          setBankDetails({ ...bankDetails, branch: e.target.value });
                          if (error) setError("");
                        }}
                        className="w-full px-4 py-2.5 bg-[#F1F5F9] border-none rounded-xl text-sm focus:ring-2 focus:ring-[#1D2B83] outline-none transition-all font-semibold text-slate-700"
                        placeholder="Auto-filled via IFSC"
                      />
                    </div>
                  </div>

                  {ifscVerified && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] text-emerald-700 font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>RazorpayX Verified: {bankDetails.bank_name} ({bankDetails.branch} Branch)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500 font-bold text-center mb-6">{error}</p>}

        <div className="flex flex-col gap-3">
          <button
            onClick={currentStep < 3 ? handleNextStep : handleSubmit}
            disabled={loading}
            className="w-full bg-[#1D2B83] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all hover:bg-[#161F63]"
          >
            <span className="text-[15px]">{loading ? "Saving..." : "Continue"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : router.back()}
            className="text-slate-400 hover:text-[#1D2B83] font-bold text-[13px] py-1 text-center transition-colors"
          >
            {currentStep === 3 ? "Go Back" : "Previous Step"}
          </button>

          {currentStep === 3 && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-2 animate-pulse">
              <Info className="w-3.5 h-3.5" />
              <span>Your data is encrypted and stored securely</span>
            </div>
          )}
        </div>
      </motion.div>

      <CelebrationModal
        open={isSuccessOpen}
        onClose={handleFinalSuccess}
        title="Registration Complete!"
        subtitle="Your profile is now under review. We'll notify you once it's approved!"
      />
    </div>
  );
}
