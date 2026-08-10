"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldCheck, Trash2, X, RefreshCw, CheckCircle2, Lock, ArrowRight, ExternalLink } from "lucide-react";
import axios from "axios";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: "CUSTOMER" | "PROVIDER";
  userId?: string;
  token?: string;
  onDeletionConfirmed: () => void;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  userType,
  userId,
  token,
  onDeletionConfirmed,
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<number>(1); // 1: Warning, 2: Obligation check, 3: Re-auth, 4: Typed confirmation, 5: Complete
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [obligations, setObligations] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [requestId, setRequestId] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const AUTH_API = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || "http://localhost:5001";

  if (!isOpen) return null;

  // Step 1 -> Step 2: Check obligations
  const handleProceedToPreCheck = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      // Trigger initiation pre-check
      const res = await axios.post(
        `${AUTH_API}/api/users/deletion/initiate`,
        { user_id: userId, account_type: userType },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.status === "PROCESSING") {
        setRequestId(res.data.request_id);
        setStep(5); // Complete / Session Revoked
        onDeletionConfirmed();
      }
    } catch (err: any) {
      if (err?.response?.data?.status === "BLOCKED_PENDING_OBLIGATION") {
        setObligations(err.response.data.blocking_obligations || []);
        setRequestId(err.response.data.request_id || "");
        setStep(2); // Blocked
      } else {
        setErrorMsg(err?.response?.data?.message || "Failed checking account obligations.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Final Confirmation Submit
  const handleFinalSubmit = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      setErrorMsg("Please type 'DELETE' to confirm account deletion.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      const res = await axios.post(
        `${AUTH_API}/api/users/deletion/initiate`,
        { user_id: userId, reason: "In-App user deletion request" },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data?.success) {
        setRequestId(res.data.request_id);
        setStep(5);
        setTimeout(() => {
          onDeletionConfirmed();
        }, 2000);
      }
    } catch (err: any) {
      if (err?.response?.data?.status === "BLOCKED_PENDING_OBLIGATION") {
        setObligations(err.response.data.blocking_obligations || []);
        setStep(2);
      } else {
        setErrorMsg(err?.response?.data?.message || "Failed initiating deletion request.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden space-y-0">
        {/* Header */}
        <div className="p-6 bg-rose-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide">Delete {userType === "PROVIDER" ? "Provider" : "Customer"} Account</h3>
              <p className="text-[11px] text-rose-200 font-bold uppercase tracking-wider">
                Google Play Account Deletion Specification
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* SCREEN 1: Plain-Language Consequences Warning */}
        {step === 1 && (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
              <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Account Deletion Information
              </h4>
              <p className="text-xs text-rose-800 leading-relaxed font-medium">
                Deleting your account is permanent. Deactivation or logging out is not substituted for account deletion.
              </p>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <strong className="text-slate-900 block mb-1">🗑️ Deleted Immediately</strong>
                Your profile, saved addresses, personal preferences, device tokens, and active sessions.
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <strong className="text-slate-900 block mb-1">🔒 Anonymized Records</strong>
                Historical booking and review records are anonymized (<code className="text-rose-600">DELETED_USER_XXX</code>).
              </div>

              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <strong className="text-slate-900 block mb-1">⚖️ Legally Retained Records</strong>
                Invoices, tax accounting, and statutory payment transaction records are retained per RBI and tax regulations.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToPreCheck}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-900/20"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Continue to Deletion"}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 2: Obligations Blocked */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Pending Obligations Must Be Resolved
              </h4>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                Your account deletion cannot complete immediately because the following obligations remain active:
              </p>
            </div>

            <ul className="space-y-2">
              {obligations.map((item, idx) => (
                <li key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-center justify-between">
              <span>Need assistance resolving obligations?</span>
              <a
                href="https://bharatclap.com/support"
                target="_blank"
                rel="noreferrer"
                className="font-black text-[#1D2B83] flex items-center gap-1 hover:underline"
              >
                Contact Support <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Close & Resolve Obligations
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 5: Completed & Session Revoked */}
        {step === 5 && (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-900/10 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800">Deletion Request Confirmed</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Your deletion request <strong className="text-slate-800 font-mono">#{requestId}</strong> has been submitted. All active sessions have been revoked immediately.
            </p>
            <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              SLA: Completed within 30 days per Privacy Policy
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
