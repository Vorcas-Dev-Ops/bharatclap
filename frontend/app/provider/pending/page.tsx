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

          if (data.kyc_status === 'verified') {
            if (data.kitPurchased) {
              if (data.kitApprovalStatus === 'approved') {
                router.push('/provider/dashboard');
              }
            } else {
              router.push('/provider/onboarding/kit');
            }
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

  const isRejected = provider?.kyc_status === 'rejected';
  const isKitAwaitingApproval = provider?.kyc_status === 'verified' && provider?.kitPurchased && provider?.kitApprovalStatus === 'pending';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center">
        <div className="bg-slate-50 py-12 px-6 flex flex-col items-center border-b border-slate-100">
          <div className={`p-4 rounded-full mb-6 ${
            isRejected ? 'bg-red-100 text-red-600' : 
            isKitAwaitingApproval ? 'bg-blue-100 text-blue-600' : 
            'bg-blue-100 text-[#1D2B83]'
          }`}>
            {isRejected ? <AlertCircle size={48} /> : <Clock size={48} />}
          </div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-4">
            {isRejected ? 'Verification Update Required' : 
             isKitAwaitingApproval ? 'Kit Purchase Awaiting Approval' :
             'Account Under Review'}
          </h1>
          
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            {isRejected 
              ? 'There was an issue with your verification documents. Please review the feedback and update your profile.'
              : isKitAwaitingApproval
                ? 'Your payment was successful! Your dashboard and orders will be unlocked after admin approval is completed.'
                : 'Our team is currently verifying your documents. This process usually takes 24-48 hours. We will notify you via email once approved.'}
          </p>
        </div>

        {isRejected && provider?.kyc_rejection_reason && (
          <div className="p-8 bg-red-50 text-left border-b border-red-100">
            <h3 className="text-red-800 font-semibold mb-2 flex items-center gap-2">
              <FileText size={18} /> Reason for Rejection
            </h3>
            <p className="text-red-700 bg-white p-4 rounded-lg border border-red-200 whitespace-pre-wrap">
              {provider.kyc_rejection_reason}
            </p>
          </div>
        )}

        <div className="p-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">What happens next?</h3>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">1</div>
              <h4 className="font-medium text-slate-900 mb-1">Document Check</h4>
              <p className="text-sm text-slate-500">We verify your ID and certifications for quality assurance.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">2</div>
              <h4 className="font-medium text-slate-900 mb-1">Provider Kit</h4>
              <p className="text-sm text-slate-500">Once approved, you'll select your provider starter kit.</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl">
              <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 mb-3">3</div>
              <h4 className="font-medium text-slate-900 mb-1">Start Earning</h4>
              <p className="text-sm text-slate-500">Get access to your dashboard and start accepting jobs.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <HelpCircle size={18} />
            Need help? Contact our support team.
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            {isRejected && (
              <button 
                onClick={() => router.push('/provider/dashboard?edit=profile')}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-[#1D2B83] text-white rounded-lg font-medium hover:bg-blue-900 transition-colors"
              >
                Update Profile
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
