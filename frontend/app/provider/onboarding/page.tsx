"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Building,
  Phone,
  Mail,
  Camera,
  Layers,
  Check,
  Plus,
  Trash2,
  MapPin,
  Compass,
  Briefcase,
  Clock,
  AlertTriangle,
  Award,
  CreditCard,
  Landmark,
  ShieldCheck,
  FileText,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Send,
  Sparkles
} from "lucide-react";
import { API_URL } from "@/config/api";
import { lookupRazorpayIfsc } from "@/utils/razorpayIfsc";
import CategoryIcon from "@/components/common/CategoryIcon";

interface Category {
  id?: string;
  _id?: string;
  name?: string;
  category_name?: string;
  icon?: string;
  image?: string;
  description?: string;
}

interface Service {
  id?: string;
  _id?: string;
  name?: string;
  service_name?: string;
  category_id?: string;
  base_price?: number;
}

interface SubService {
  id?: string;
  _id?: string;
  name?: string;
  subservice_name?: string;
  service_id?: string;
}

interface LocationItem {
  id?: string;
  _id?: string;
  name: string;
  city?: string;
  state?: string;
}

const DEFAULT_FALLBACK_LOCATIONS: LocationItem[] = [
  { id: "blr-kor", name: "Koramangala", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-ind", name: "Indiranagar", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-hsr", name: "HSR Layout", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-wfd", name: "Whitefield", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-jyn", name: "Jayanagar", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-jpn", name: "JP Nagar", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-btm", name: "BTM Layout", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-ecity", name: "Electronic City", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-bell", name: "Bellandur", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-marath", name: "Marathahalli", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-hebbal", name: "Hebbal", city: "Bengaluru", state: "Karnataka" },
  { id: "blr-mallesh", name: "Malleshwaram", city: "Bengaluru", state: "Karnataka" },
];

export default function ProviderOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Wizard Steps (1-6)
  // 1: Basic Info, 2: Select Services, 3: Service Location, 4: Professional Details, 5: KYC & Bank, 6: Profile Preview
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [token, setToken] = useState<string>("");

  // Catalog & Location data
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationItem[]>([]);

  // ── Step 1: Basic Information ──
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const profileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Selected Services & Skills ──
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedSubServiceIds, setSelectedSubServiceIds] = useState<string[]>([]);

  // ── Step 3: Service Location & Radius ──
  const [selectedCity, setSelectedCity] = useState("Bengaluru");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [serviceRadiusKm, setServiceRadiusKm] = useState<number>(10);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [newLocationInput, setNewLocationInput] = useState("");

  // ── Step 4: Professional Details ──
  const [experienceYears, setExperienceYears] = useState<number>(3);
  const [businessType, setBusinessType] = useState<"individual" | "agency">("individual");
  const [workingHoursStart, setWorkingHoursStart] = useState("09:00 AM");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("08:00 PM");
  const [emergencyService, setEmergencyService] = useState<boolean>(false);
  const [certificateDoc, setCertificateDoc] = useState<{ name: string; url: string } | null>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  // ── Step 5: KYC & Bank Details ──
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [idProofDoc, setIdProofDoc] = useState<{ name: string; url: string } | null>(null);
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfscCode, setBankIfscCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [upiId, setUpiId] = useState("");
  const [ifscVerifying, setIfscVerifying] = useState(false);
  const [ifscValid, setIfscValid] = useState(false);
  const idProofInputRef = useRef<HTMLInputElement>(null);

  // ── Step 6: Confirmation ──
  const [agreeAccurate, setAgreeAccurate] = useState(false);

  // Check URL query param for step navigation e.g. /provider/onboarding?step=3
  useEffect(() => {
    const qStep = searchParams.get("step");
    if (qStep) {
      const stepNum = parseInt(qStep, 10);
      if (stepNum >= 1 && stepNum <= 6) {
        setCurrentStep(stepNum);
      }
    }
  }, [searchParams]);

  // Initial Load: Auth, Provider Profile, Catalog, Locations
  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");

      if (!storedToken) {
        router.push("/provider/register");
        return;
      }
      setToken(storedToken);

      try {
        const u = storedUser ? JSON.parse(storedUser) : null;
        if (u) {
          setFullName(u.name || "");
          setMobileNumber(u.phone || "");
          setEmailAddress(u.email || "");
          if (u.profile_image) setProfilePhoto(u.profile_image);
        }

        // Fetch Provider Me profile
        const pRes = await fetch(`${API_URL}/providers/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (pRes.ok) {
          const pData = await pRes.json();
          // If already approved, route to dashboard
          const isApproved = pData.onboarding_status ? pData.onboarding_status === "APPROVED" : pData.kyc_status === "verified";
          if (isApproved) {
            router.push("/provider/dashboard");
            return;
          }
          // If submitted/under review, route to pending/submitted page
          if (pData.onboarding_status === "UNDER_REVIEW" || pData.onboarding_status === "submitted") {
            router.push("/provider/onboarding/submitted");
            return;
          }

          // Restore draft if available
          if (pData.onboarding_draft) {
            const draft = pData.onboarding_draft;
            if (draft.business_name) setBusinessName(draft.business_name);
            if (draft.full_name) setFullName(draft.full_name);
            if (draft.profile_photo) setProfilePhoto(draft.profile_photo);
            if (draft.category_id) setSelectedCategoryId(draft.category_id);
            if (draft.service_ids) setSelectedServiceIds(draft.service_ids);
            if (draft.subservice_ids) setSelectedSubServiceIds(draft.subservice_ids);
            if (draft.city) setSelectedCity(draft.city);
            if (draft.location_ids) setSelectedLocationIds(draft.location_ids);
            if (draft.custom_locations) setCustomLocations(draft.custom_locations);
            if (draft.service_radius_km) setServiceRadiusKm(draft.service_radius_km);
            if (draft.experience_years) setExperienceYears(draft.experience_years);
            if (draft.business_type) setBusinessType(draft.business_type);
            if (draft.working_hours_start) setWorkingHoursStart(draft.working_hours_start);
            if (draft.working_hours_end) setWorkingHoursEnd(draft.working_hours_end);
            if (draft.emergency_service !== undefined) setEmergencyService(draft.emergency_service);
            if (draft.certificate_doc) setCertificateDoc(draft.certificate_doc);
            if (draft.pan_number) setPanNumber(draft.pan_number);
            else if (draft.pan_last4) setPanNumber(`••••••${draft.pan_last4}`);
            if (draft.aadhaar_number) setAadhaarNumber(draft.aadhaar_number);
            else if (draft.aadhaar_last4) setAadhaarNumber(`••••••••${draft.aadhaar_last4}`);
            if (draft.id_proof_doc) setIdProofDoc(draft.id_proof_doc);
            if (draft.upi_id) setUpiId(draft.upi_id);
          }

          if (pData.bank_details) {
            setBankHolderName(pData.bank_details.account_holder_name || "");
            setBankIfscCode(pData.bank_details.ifsc_code || "");
            setBankName(pData.bank_details.bank_name || "");
            setBankBranch(pData.bank_details.branch || "");
            if (pData.bank_details.account_number_last4) {
              setBankAccountNumber(`••••••••${pData.bank_details.account_number_last4}`);
            }
            if (pData.bank_details.ifsc_code) setIfscValid(true);
          }

          if (pData.service_radius) {
            setServiceRadiusKm(Math.round(pData.service_radius / 1000) || 10);
          }
        }

        // Fetch Categories
        const catRes = await fetch(`${API_URL}/categories`);
        if (catRes.ok) {
          const catData = await catRes.json();
          const items = Array.isArray(catData) ? catData : catData.data || [];
          setCategories(items);
        }

        // Fetch Locations (Admin-configured active locations in Bengaluru)
        const locRes = await fetch(`${API_URL}/locations?status=active&city=Bengaluru`);
        if (locRes.ok) {
          const locData = await locRes.json();
          const rawLocs = Array.isArray(locData) ? locData : locData.data || [];
          const blrLocs = rawLocs.filter((l: any) => /^(bengaluru|bangalore)$/i.test(l.city || ""));
          setAvailableLocations(blrLocs.length > 0 ? blrLocs : DEFAULT_FALLBACK_LOCATIONS);
        } else {
          setAvailableLocations(DEFAULT_FALLBACK_LOCATIONS);
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  // When selected category changes, fetch its services
  useEffect(() => {
    if (!selectedCategoryId) return;
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_URL}/services?category_id=${selectedCategoryId}`);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.data || [];
          setServices(items);
        }
      } catch {}
    };
    fetchServices();
  }, [selectedCategoryId]);

  // When selected services change, fetch their subservices
  useEffect(() => {
    if (selectedServiceIds.length === 0) {
      setSubServices([]);
      return;
    }
    const fetchSubServices = async () => {
      try {
        const allSubs: SubService[] = [];
        for (const sId of selectedServiceIds) {
          const res = await fetch(`${API_URL}/sub-services?service_id=${sId}`);
          if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data) ? data : data.data || [];
            allSubs.push(...items);
          }
        }
        setSubServices(allSubs);
      } catch {}
    };
    fetchSubServices();
  }, [selectedServiceIds]);

  // Handle IFSC lookup
  const handleIfscChange = async (val: string) => {
    const clean = val.trim().toUpperCase();
    setBankIfscCode(clean);
    setIfscValid(false);

    if (clean.length === 11) {
      setIfscVerifying(true);
      const info = await lookupRazorpayIfsc(clean);
      setIfscVerifying(false);
      if (info) {
        setBankName(info.bankName);
        setBankBranch(info.branch);
        setIfscValid(true);
      }
    }
  };

  // Save progress draft helper
  const saveDraft = async (override?: any) => {
    if (!token) return;
    try {
      const draftPayload = {
        full_name: fullName,
        business_name: businessName,
        profile_photo: profilePhoto,
        category_id: selectedCategoryId,
        service_ids: selectedServiceIds,
        subservice_ids: selectedSubServiceIds,
        city: selectedCity,
        location_ids: selectedLocationIds,
        custom_locations: customLocations,
        service_radius_km: serviceRadiusKm,
        experience_years: experienceYears,
        business_type: businessType,
        working_hours_start: workingHoursStart,
        working_hours_end: workingHoursEnd,
        emergency_service: emergencyService,
        certificate_doc: certificateDoc,
        // DPDP/Security: Never store raw plaintext PAN, Aadhaar, or Bank accounts in draft JSON
        has_pan: Boolean(panNumber.trim()),
        pan_last4: panNumber.trim().length >= 4 ? panNumber.trim().slice(-4) : undefined,
        has_aadhaar: Boolean(aadhaarNumber.trim()),
        aadhaar_last4: aadhaarNumber.replace(/\s/g, "").length >= 4 ? aadhaarNumber.replace(/\s/g, "").slice(-4) : undefined,
        id_proof_doc: idProofDoc,
        upi_id: upiId,
        ...override,
      };

      await fetch(`${API_URL}/providers/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          onboarding_step: currentStep,
          onboarding_draft: draftPayload,
          service_radius: serviceRadiusKm * 1000,
          bank_details: bankHolderName && bankAccountNumber && bankIfscCode ? {
            account_holder_name: bankHolderName,
            account_number: bankAccountNumber,
            ifsc_code: bankIfscCode,
            bank_name: bankName,
            branch: bankBranch,
          } : undefined,
        }),
      });
    } catch (e) {
      console.error("Draft autosave failed", e);
    }
  };

  // Navigation handlers
  const goToNextStep = () => {
    setError("");

    // Step 1 Validation
    if (currentStep === 1) {
      if (!fullName.trim()) return setError("Full name is required.");
    }

    // Step 2 Validation
    if (currentStep === 2) {
      if (!selectedCategoryId) return setError("Please select at least one primary service category.");
      if (selectedServiceIds.length === 0) return setError("Please select at least one service offering.");
    }

    // Step 3 Validation
    if (currentStep === 3) {
      if (selectedLocationIds.length === 0 && customLocations.length === 0) {
        return setError("Please select at least one service location area.");
      }
    }

    // Step 4 Validation
    if (currentStep === 4) {
      if (experienceYears < 0) return setError("Please enter valid years of experience.");
    }

    // Step 5 Validation
    if (currentStep === 5) {
      if (!panNumber.trim() && !aadhaarNumber.trim()) {
        return setError("Please provide either PAN or Aadhaar for identity verification.");
      }
      if (aadhaarNumber.trim() && !/^\d{12}$/.test(aadhaarNumber.replace(/\s/g, ""))) {
        return setError("Aadhaar number must be exactly 12 digits.");
      }
      if (!idProofDoc) {
        return setError("Please upload your government ID proof document.");
      }
      if (!bankHolderName.trim()) return setError("Bank account holder name is required.");
      if (!bankAccountNumber.trim() || bankAccountNumber.length < 8) {
        return setError("Please enter a valid bank account number.");
      }
      if (!bankIfscCode.trim() || bankIfscCode.length !== 11) {
        return setError("Please enter a valid 11-character IFSC code.");
      }
    }

    const next = Math.min(currentStep + 1, 6);
    setCurrentStep(next);
    saveDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToPrevStep = () => {
    setError("");
    const prev = Math.max(currentStep - 1, 1);
    setCurrentStep(prev);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Final Submit ──
  const handleFinalSubmit = async () => {
    if (!agreeAccurate) {
      setError("Please confirm that all provided details and documents are authentic.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // 1. Get current provider ID
      const pRes = await fetch(`${API_URL}/providers/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pData = await pRes.json();
      if (!pRes.ok) throw new Error(pData.message || "Failed to find provider profile.");
      const providerId = pData._id || pData.id;

      // 2. Persist Identity and Bank Details via PUT /me
      const updateMeRes = await fetch(`${API_URL}/providers/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          aadhar_id: aadhaarNumber.replace(/\s/g, "") || undefined,
          service_radius: serviceRadiusKm * 1000,
          bank_details: {
            account_holder_name: bankHolderName,
            account_number: bankAccountNumber,
            ifsc_code: bankIfscCode,
            bank_name: bankName,
            branch: bankBranch,
          },
          verification_docs: {
            id_proof_url: idProofDoc?.url || "",
            selfie_url: profilePhoto || "",
          },
          onboarding_draft: {
            full_name: fullName,
            business_name: businessName,
            profile_photo: profilePhoto,
            category_id: selectedCategoryId,
            service_ids: selectedServiceIds,
            subservice_ids: selectedSubServiceIds,
            city: selectedCity,
            location_ids: selectedLocationIds,
            custom_locations: customLocations,
            service_radius_km: serviceRadiusKm,
            experience_years: experienceYears,
            business_type: businessType,
            working_hours_start: workingHoursStart,
            working_hours_end: workingHoursEnd,
            emergency_service: emergencyService,
            has_pan: Boolean(panNumber.trim()),
            pan_last4: panNumber.trim().length >= 4 ? panNumber.trim().slice(-4) : undefined,
            has_aadhaar: Boolean(aadhaarNumber.trim()),
            aadhaar_last4: aadhaarNumber.replace(/\s/g, "").length >= 4 ? aadhaarNumber.replace(/\s/g, "").slice(-4) : undefined,
            upi_id: upiId,
            submitted_at: new Date().toISOString(),
          },
        }),
      });

      if (!updateMeRes.ok) {
        const uErr = await updateMeRes.json();
        throw new Error(uErr.message || "Failed to update provider details.");
      }

      // 3. Register selected services in ProviderServices
      for (const sId of selectedServiceIds) {
        const svc = services.find((s) => (s._id || s.id) === sId);
        const relatedSubIds = subServices
          .filter((sub) => sub.service_id === sId && selectedSubServiceIds.includes(sub._id || sub.id || ""))
          .map((sub) => sub._id || sub.id || "");

        await fetch(`${API_URL}/provider-services`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            provider_id: providerId,
            service_id: sId,
            experience: experienceYears,
            price: svc?.base_price || 299,
            subservice_ids: relatedSubIds.length > 0 ? relatedSubIds : [sId],
            location_ids: selectedLocationIds,
            documents: certificateDoc ? [{ doc_type: "Certificate", file_url: certificateDoc.url }] : [],
          }),
        }).catch(() => {});
      }

      // 4. Formally Submit Provider Application for Admin Review
      const submitRes = await fetch(`${API_URL}/providers/me/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!submitRes.ok) {
        const subErr = await submitRes.json();
        throw new Error(subErr.message || "Submission for review failed.");
      }

      // 5. Navigate to Submission Confirmation Screen
      router.push("/provider/onboarding/submitted");
    } catch (err: any) {
      setError(err.message || "Failed to complete provider registration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1D2B83] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading onboarding details...</p>
        </div>
      </div>
    );
  }

  const stepTitles = [
    { num: 1, label: "Basic Info", icon: User },
    { num: 2, label: "Services", icon: Layers },
    { num: 3, label: "Location", icon: MapPin },
    { num: 4, label: "Details", icon: Briefcase },
    { num: 5, label: "KYC & Bank", icon: ShieldCheck },
    { num: 6, label: "Review", icon: CheckCircle2 },
  ];

  const selectedCategory = categories.find((c) => (c._id || c.id) === selectedCategoryId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16">
      {/* ─── In-Page Stepper Card ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pt-4 mb-2">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 relative z-10">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black px-3 py-1 rounded-full bg-blue-50 text-[#1D2B83] border border-blue-100">
                Provider Onboarding
              </span>
              <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                Complete your profile to start receiving job requests
              </span>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Step {currentStep} of 6
            </span>
          </div>

          {/* Stepper Tabs Bar */}
          <div className="overflow-x-auto scrollbar-none flex items-center justify-between gap-2">
            {stepTitles.map((s) => {
              const isDone = s.num < currentStep;
              const isCurrent = s.num === currentStep;
              const Icon = s.icon;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    if (s.num <= currentStep) setCurrentStep(s.num);
                  }}
                  disabled={s.num > currentStep}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isCurrent
                      ? "bg-[#1D2B83] text-white shadow-sm"
                      : isDone
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                      : "text-slate-400 bg-transparent cursor-not-allowed"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                    isCurrent ? "bg-white text-[#1D2B83]" : isDone ? "bg-emerald-200 text-emerald-800" : "bg-slate-200 text-slate-500"
                  }`}>
                    {isDone ? <Check size={12} strokeWidth={3} /> : s.num}
                  </div>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Main Content Container ────────────────────────────── */}
      <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 pt-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3">
            <AlertCircle size={18} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
          {/* ════════════════════════════════════════════════════════
              STEP 1: Basic Provider Information
          ════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  1. Basic Provider Information
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tell us who you are and what business name customers should see.
                </p>
              </div>

              {/* Profile Photo */}
              <div className="flex items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setProfilePhoto(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <div className="relative group">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-md flex items-center justify-center flex-shrink-0">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-slate-400" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-[#1D2B83] text-white rounded-xl shadow-md hover:bg-blue-900 transition-colors"
                    title="Change Photo"
                  >
                    <Camera size={14} />
                  </button>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Profile Photo</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Clear, recognizable photo helps customers identify you at their doorstep.
                  </p>
                  <button
                    type="button"
                    onClick={() => profileInputRef.current?.click()}
                    className="mt-2 text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Upload size={12} /> Upload Photo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business / Professional Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sharma Electricals (or Self-employed)"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    disabled
                    value={mobileNumber}
                    className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="rajesh@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 2: Select Services
          ════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  2. Select Services You Offer
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose your primary category, then pick the specific services and specializations you provide.
                </p>
              </div>

              {/* Category Picker */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                  Select Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {categories.map((cat) => {
                    const catId = cat._id || cat.id || "";
                    const isSelected = selectedCategoryId === catId;
                    return (
                      <button
                        key={catId}
                        type="button"
                        onClick={() => {
                          setSelectedCategoryId(catId);
                          setSelectedServiceIds([]);
                          setSelectedSubServiceIds([]);
                        }}
                        className={`p-3 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition-all ${
                          isSelected
                            ? "bg-blue-50 border-[#1D2B83] text-[#1D2B83] shadow-md ring-2 ring-blue-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-2 overflow-hidden">
                          <CategoryIcon
                            icon={cat.icon || cat.image}
                            categoryName={cat.category_name || cat.name}
                            className="w-6 h-6 object-contain"
                          />
                        </div>
                        <span className="text-xs font-bold line-clamp-1">
                          {cat.category_name || cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Offerings */}
              {selectedCategoryId && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                    Select Services Under {selectedCategory?.category_name || selectedCategory?.name} <span className="text-red-500">*</span>
                  </label>

                  {services.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Loading services...</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {services.map((svc) => {
                        const sId = svc._id || svc.id || "";
                        const isSelected = selectedServiceIds.includes(sId);
                        return (
                          <div
                            key={sId}
                            onClick={() => {
                              setSelectedServiceIds((prev) =>
                                isSelected ? prev.filter((id) => id !== sId) : [...prev, sId]
                              );
                            }}
                            className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                              isSelected
                                ? "bg-blue-50 border-[#1D2B83] text-[#1D2B83]"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span className="text-xs font-bold">
                              {svc.service_name || svc.name}
                            </span>
                            <div className={`w-5 h-5 rounded-lg border flex items-center justify-center ${
                              isSelected ? "bg-[#1D2B83] border-[#1D2B83] text-white" : "border-slate-300 bg-white"
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-services / Specializations */}
              {selectedServiceIds.length > 0 && subServices.length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Skills / Specializations (Optional)
                  </label>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Check all specific repair and installation tasks you are comfortable performing.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {subServices.map((sub) => {
                      const subId = sub._id || sub.id || "";
                      const isSelected = selectedSubServiceIds.includes(subId);
                      return (
                        <button
                          key={subId}
                          type="button"
                          onClick={() => {
                            setSelectedSubServiceIds((prev) =>
                              isSelected ? prev.filter((id) => id !== subId) : [...prev, subId]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {isSelected && <Check size={12} className="inline mr-1" />}
                          {sub.subservice_name || sub.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 3: Service Location & Radius
          ════════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  3. Service Locations & Coverage
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Specify where you are available to travel and your operational service radius.
                </p>
              </div>

              {/* City Indicator - Strictly Bengaluru Only */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                    Primary Operating City
                  </label>
                  <p className="text-sm font-extrabold text-[#1D2B83] flex items-center gap-1.5">
                    <MapPin size={16} className="text-blue-600 shrink-0" />
                    Bengaluru, Karnataka
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    BharatClap currently operates exclusively across the Bengaluru metropolitan region.
                  </p>
                </div>
                <span className="text-[11px] font-extrabold bg-blue-100/80 text-[#1D2B83] px-3 py-1 rounded-full border border-blue-200 shrink-0">
                  Active Region
                </span>
              </div>

              {/* Service Areas (Admin-Managed Master Locations) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-800">
                    Select Operating Areas in Bengaluru <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                    {selectedLocationIds.length} Selected
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-3 font-normal">
                  All service areas are added and authorized by BharatClap Admin. Select all neighborhoods where you are available to fulfill bookings.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1.5 border border-slate-200/80 rounded-2xl bg-slate-50/50">
                  {availableLocations.map((loc) => {
                    const lId = loc._id || loc.id || "";
                    const isSelected = selectedLocationIds.includes(lId);
                    return (
                      <button
                        key={lId}
                        type="button"
                        onClick={() => {
                          setSelectedLocationIds((prev) =>
                            isSelected ? prev.filter((id) => id !== lId) : [...prev, lId]
                          );
                        }}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          isSelected
                            ? "bg-blue-50 border-[#1D2B83] text-[#1D2B83] font-bold shadow-xs ring-1 ring-blue-500/20"
                            : "bg-white border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{loc.name}</span>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ml-1.5 ${
                          isSelected ? "bg-[#1D2B83] border-[#1D2B83] text-white" : "border-slate-300 bg-white"
                        }`}>
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Radius Slider */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Compass size={14} className="text-blue-600" /> Maximum Travel Radius
                  </label>
                  <span className="text-sm font-black text-[#1D2B83] bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                    {serviceRadiusKm} km
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={serviceRadiusKm}
                  onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                  className="w-full accent-[#1D2B83] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                  <span>2 km (Local only)</span>
                  <span>10 km (Recommended)</span>
                  <span>30 km (City-wide)</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 4: Professional Details
          ════════════════════════════════════════════════════════ */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  4. Professional Details & Availability
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Help us understand your experience level, working hours, and emergency availability.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Years of Experience */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Years of Experience <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="number"
                      min={0}
                      max={50}
                      required
                      placeholder="e.g. 5"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Business Type */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Business Type
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBusinessType("individual")}
                      className={`flex-1 py-3 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        businessType === "individual"
                          ? "bg-[#1D2B83] text-white border-[#1D2B83]"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      Individual / Freelancer
                    </button>
                    <button
                      type="button"
                      onClick={() => setBusinessType("agency")}
                      className={`flex-1 py-3 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        businessType === "agency"
                          ? "bg-[#1D2B83] text-white border-[#1D2B83]"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      Registered Agency
                    </button>
                  </div>
                </div>

                {/* Working Hours Start */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Working Hours: Start
                  </label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="09:00 AM"
                      value={workingHoursStart}
                      onChange={(e) => setWorkingHoursStart(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Working Hours End */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Working Hours: End
                  </label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="08:00 PM"
                      value={workingHoursEnd}
                      onChange={(e) => setWorkingHoursEnd(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Service Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Emergency & 24/7 Service Calls</h4>
                    <p className="text-[11px] text-slate-500">
                      Are you willing to receive urgent/night emergency service bookings at premium rates?
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyService(!emergencyService)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                    emergencyService ? "bg-[#1D2B83]" : "bg-slate-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    emergencyService ? "translate-x-6" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* Certificate / License Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Certificates / License / Qualifications (Optional)
                </label>
                <input
                  ref={certInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setCertificateDoc({
                        name: file.name,
                        url: reader.result as string,
                      });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                {certificateDoc ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <Award size={18} className="text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-800 truncate max-w-xs">
                        {certificateDoc.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertificateDoc(null)}
                      className="text-xs text-red-600 hover:underline font-bold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => certInputRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 transition-colors bg-slate-50"
                  >
                    <Award size={24} className="mb-1 text-slate-400" />
                    <span className="text-xs font-bold">Upload Trade Certificate or License</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG or PDF up to 10MB</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 5: KYC / Verification & Bank
          ════════════════════════════════════════════════════════ */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  5. KYC Verification & Bank Details
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Required by Indian law for identity verification and receiving direct weekly payouts.
                </p>
              </div>

              {/* Identity Details */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Government Identity (PAN / Aadhaar)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Aadhaar Number (12 Digits) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      placeholder="1234 5678 9012"
                      value={aadhaarNumber}
                      onChange={(e) => setAadhaarNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      PAN Number (10 Characters)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none uppercase"
                    />
                  </div>
                </div>

                {/* ID Proof Document Upload */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Upload Government ID Proof (Aadhaar / Voter ID / DL) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={idProofInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setIdProofDoc({
                          name: file.name,
                          url: reader.result as string,
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                  {idProofDoc ? (
                    <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck size={20} className="text-emerald-600" />
                        <span className="text-xs font-bold text-emerald-900 truncate max-w-xs">
                          {idProofDoc.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIdProofDoc(null)}
                        className="text-xs text-red-600 hover:underline font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => idProofInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-blue-600 transition-colors bg-slate-50"
                    >
                      <Upload size={22} className="mb-1 text-slate-400" />
                      <span className="text-xs font-bold">Select ID document file from device</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Stored securely in encrypted format</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Bank Account Details */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Landmark size={14} className="text-blue-600" /> Bank Payout Details
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="As per bank passbook"
                      value={bankHolderName}
                      onChange={(e) => setBankHolderName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Bank Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Account Number"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={11}
                      required
                      placeholder="e.g. HDFC0001234"
                      value={bankIfscCode}
                      onChange={(e) => handleIfscChange(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none uppercase"
                    />
                    {ifscVerifying && <p className="text-[10px] text-blue-500 mt-1">Verifying IFSC code...</p>}
                    {ifscValid && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-1">
                        ✓ {bankName} — {bankBranch}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      UPI ID (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210@upi"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              STEP 6: Provider Profile Preview
          ════════════════════════════════════════════════════════ */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  6. Provider Profile Preview
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Please review your information carefully before submitting your application for verification.
                </p>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                {/* Header Profile */}
                <div className="flex items-center gap-4 pb-4 border-b border-slate-200">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={28} className="text-slate-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{fullName}</h3>
                    <p className="text-xs font-bold text-[#1D2B83]">{businessName || "Individual Service Professional"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{mobileNumber} • {emailAddress || "No email"}</p>
                  </div>
                </div>

                {/* Grid Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Primary Category</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedCategory?.category_name || selectedCategory?.name || "None"}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Services</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedServiceIds.length} service offerings</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location & Coverage</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedCity} (Radius: {serviceRadiusKm} km)</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Experience & Type</span>
                    <p className="font-bold text-slate-800 mt-0.5">{experienceYears} Years • {businessType}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Working Hours</span>
                    <p className="font-bold text-slate-800 mt-0.5">{workingHoursStart} - {workingHoursEnd} {emergencyService && "• 24/7 Calls"}</p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bank Payout</span>
                    <p className="font-bold text-slate-800 mt-0.5">{bankHolderName} • {bankName || "Verified IFSC"}</p>
                    {bankAccountNumber && (
                      <p className="text-[10px] font-mono font-semibold text-slate-500 mt-0.5">
                        A/C: •••• •••• •••• {bankAccountNumber.slice(-4)}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">KYC Identity</span>
                    <p className="font-bold text-slate-800 mt-0.5">
                      {aadhaarNumber ? `Aadhaar: •••• •••• ${aadhaarNumber.slice(-4)}` : "Aadhaar attached"}
                    </p>
                    {panNumber && (
                      <p className="text-[10px] font-mono font-semibold text-slate-500 mt-0.5">
                        PAN: ••••• {panNumber.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Document Status */}
                <div className="pt-2 flex items-center gap-2 text-emerald-700 text-xs font-bold">
                  <ShieldCheck size={16} /> ID Proof Attached: {idProofDoc?.name}
                </div>
              </div>

              {/* Accuracy Confirmation Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                <input
                  id="confirm-accurate"
                  type="checkbox"
                  checked={agreeAccurate}
                  onChange={(e) => setAgreeAccurate(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="confirm-accurate" className="text-xs text-slate-700 leading-relaxed cursor-pointer font-medium">
                  I hereby confirm that all details, trade information, and verification documents submitted are authentic and truthful. I understand that my profile will be placed under review before activation.
                </label>
              </div>
            </div>
          )}

          {/* ─── Bottom Navigation Buttons ─── */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goToPrevStep}
                className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="px-6 py-3 bg-[#1D2B83] hover:bg-blue-900 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-900/20 transition-all flex items-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting || !agreeAccurate}
                onClick={handleFinalSubmit}
                className="px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? "Submitting Application..." : "Submit for Verification"}
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
