"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, AlertCircle, FileText, HelpCircle } from "lucide-react";

export default function PendingVerificationPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = localStorage.getItem("token") || localStorage.getItem("jwt");
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        
        const res = await fetch(`${API_URL}/providers/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          setProvider(data);

          const status = data.onboarding_status;
          if (status === 'APPROVED' || data.kyc_status === 'verified') {
            router.push('/provider/dashboard');
          } else if (status === 'DRAFT' || (!status && data.registration && !data.registration.completed)) {
            // Registration incomplete or still in draft — resume wizard
            router.push('/signup/provider/services');
          }
        }
      } catch (err) {
        console.error("Error fetching provider status", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]"></div>
      </div>
    );
  }

  const isActionRequired = provider?.onboarding_status === 'ACTION_REQUIRED' || provider?.kyc_status === 'rejected';
  const isKitAwaitingApproval = (provider?.onboarding_status === 'APPROVED' || provider?.kyc_status === 'verified') && provider?.kitPurchased && provider?.kitApprovalStatus === 'pending';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center">
        <div className="bg-slate-50 py-12 px-6 flex flex-col items-center border-b border-slate-100">
          <div className={`p-4 rounded-full mb-6 ${
            isActionRequired ? 'bg-amber-100 text-amber-700' : 
            isKitAwaitingApproval ? 'bg-blue-100 text-blue-600' : 
            'bg-blue-100 text-[#1D2B83]'
          }`}>
            {isActionRequired ? <AlertCircle size={48} /> : <Clock size={48} />}
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            {isActionRequired ? 'Action Required on Application' : 
             isKitAwaitingApproval ? 'Kit Purchase Awaiting Approval' :
             'Application Under Review'}
          </h1>
          
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            {isActionRequired 
              ? 'Our verification team has requested corrections or updates to your submitted information. Please review the remarks below and update your application.'
              : isKitAwaitingApproval
                ? 'Your payment was successful! Your dashboard and orders will be unlocked after admin approval is completed.'
                : 'Your provider application has been submitted successfully and is currently being reviewed by the BharatClap admin team. You will be notified once approved.'}
          </p>
        </div>

        {isActionRequired && provider?.kyc_rejection_reason && (
          <div className="p-8 bg-amber-50 text-left border-b border-amber-100">
            <h3 className="text-amber-900 font-semibold mb-2 flex items-center gap-2">
              <FileText size={18} /> Admin Feedback / Correction Needed
            </h3>
            <p className="text-amber-800 bg-white p-4 rounded-lg border border-amber-200 whitespace-pre-wrap">
              {provider.kyc_rejection_reason}
            </p>
          </div>
        )}

        <div className="p-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">What happens next?</h3>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">1</div>
              <h4 className="font-medium text-slate-900 mb-1">Admin Review</h4>
              <p className="text-sm text-slate-500">We verify your profile details, documents, and service categories.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">2</div>
              <h4 className="font-medium text-slate-900 mb-1">Approval & Kit</h4>
              <p className="text-sm text-slate-500">Once approved, your account is activated and starter kit options unlocked.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">3</div>
              <h4 className="font-medium text-slate-900 mb-1">Receive Bookings</h4>
              <p className="text-sm text-slate-500">Get access to your provider dashboard and start receiving jobs.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <HelpCircle size={18} />
            Need help? Contact BharatClap support team.
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {isActionRequired && (
              <button 
                onClick={() => router.push('/signup/provider/services')}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-[#1D2B83] text-white rounded-lg font-medium hover:bg-blue-900 transition-colors"
              >
                Update & Resubmit
              </button>
            )}
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
