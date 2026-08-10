"use client";

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import Link from "next/link";
import {
  PhoneCall, Clock, CheckCircle2, AlertCircle, FileText,
  Shield, HelpCircle, Ticket, X, Send, BookOpen, AlertTriangle
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";

interface SupportTicket {
  id: string;
  category: string;
  subject: string;
  status: "Open" | "In Progress" | "Waiting for Customer" | "Resolved" | "Closed";
  date: string;
  description: string;
}

const initialTickets: SupportTicket[] = [
  { id: "TKT-1082", category: "Refund Request", subject: "Refund for unassigned booking #BK-9021", status: "Resolved", date: "06 Aug 2026", description: "Booking auto-cancelled due to timeout. Full refund credited to wallet." },
  { id: "TKT-1104", category: "Payment Issue", subject: "Double deduction during Razorpay payment", status: "In Progress", date: "07 Aug 2026", description: "Razorpay transaction reference provided to billing team for reconciliation." },
];

const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
  "Open": { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  "In Progress": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "Waiting for Customer": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  "Resolved": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Closed": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
};

const ticketCategories = [
  "Booking Issue",
  "Payment Issue",
  "Refund Request",
  "Provider Issue",
  "Customer Issue",
  "Technical Issue",
  "Account Issue",
  "General Enquiry",
];

const selfServiceLinks = [
  { label: "Booking Help", href: "/help?tab=customer" },
  { label: "Payment Help", href: "/help?tab=customer" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cancellation Policy", href: "/refund-policy" },
  { label: "Provider Guidelines", href: "/provider-guidelines" },
  { label: "Community Guidelines", href: "/community-guidelines" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
];

const SupportPage = () => {
  const {
    platformName,
    supportPhone,
    workingHours,
    emergencyContact,
    supportStatus,
  } = useSettings();

  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets);
  const [showModal, setShowModal] = useState(false);
  const [newCategory, setNewCategory] = useState("Booking Issue");
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submittedMessage, setSubmittedMessage] = useState("");

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;

    const newTicket: SupportTicket = {
      id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      category: newCategory,
      subject: newSubject.trim(),
      status: "Open",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      description: newDescription.trim(),
    };

    setTickets([newTicket, ...tickets]);
    setNewSubject("");
    setNewDescription("");
    setShowModal(false);
    setSubmittedMessage(`Ticket ${newTicket.id} created successfully! Our support team will contact you via phone.`);
    setTimeout(() => setSubmittedMessage(""), 6000);
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        
        {/* Header */}
        <div className="text-center sm:text-left space-y-1">
          <span className="px-3 py-1 bg-blue-50 text-[#1D2B83] text-[11px] font-black uppercase tracking-widest rounded-full border border-blue-100">
            Official Support Hub
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">{platformName} Support Center</h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Get instant phone assistance or submit an internal ticket for tracking.
          </p>
        </div>

        {submittedMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{submittedMessage}</span>
          </div>
        )}

        {/* Primary Support Channel Banner with Live Status */}
        <div className="bg-gradient-to-r from-[#1D2B83] to-[#2A3DA8] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 border border-blue-900">
          <div className="space-y-3 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <div className={`inline-flex items-center gap-2 px-3 py-1 text-xs font-black uppercase tracking-widest rounded-full border ${supportStatus.bgColor} ${supportStatus.textColor}`}>
                {supportStatus.badge}
              </div>
              <span className="text-xs text-blue-200 font-semibold">• Response Time: {supportStatus.expectedResponseTime}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">📞 Phone Support (Official Helpline)</h2>
            <div className="space-y-1 text-xs sm:text-sm text-blue-100">
              <p className="flex items-center justify-center md:justify-start gap-2">
                <Clock className="w-4 h-4 text-emerald-300" />
                <strong>Operating Hours:</strong> {workingHours}
              </p>
            </div>
          </div>

          <a
            href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-3 shadow-xl transition-all active:scale-95 flex-shrink-0"
          >
            <PhoneCall className="w-5 h-5" /> Call {supportPhone}
          </a>
        </div>

        {/* Self-Service Help Links Grid */}
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#1D2B83]" /> Self-Service Help &amp; Policies
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {selfServiceLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="p-4 bg-white hover:bg-blue-50/50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 hover:text-[#1D2B83] hover:border-blue-200 transition-all shadow-sm flex items-center justify-between"
              >
                <span>{item.label}</span>
                <span className="text-slate-400">→</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Ticket Management Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#1D2B83]" /> Raise a Support Request
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Submit an internal ticket if call lines are busy or for detailed transaction audits.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-5 py-2.5 bg-[#1D2B83] hover:bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              + Raise New Ticket
            </button>
          </div>

          {/* Ticket List */}
          <div className="divide-y divide-slate-100">
            {tickets.length === 0 ? (
              <div className="p-10 text-center text-slate-400 font-medium text-xs">
                No active support tickets found.
              </div>
            ) : (
              tickets.map((t) => {
                const style = statusStyles[t.status] || statusStyles["Open"];
                return (
                  <div key={t.id} className="p-6 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#1D2B83]">{t.id}</span>
                        <span className="text-xs font-semibold text-slate-400">• {t.category}</span>
                        <span className="text-xs text-slate-400">• {t.date}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{t.subject}</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${style.bg} ${style.text} ${style.border} flex-shrink-0`}>
                      {t.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Emergency Escalation Footer Note */}
        <div className="p-6 bg-slate-900 rounded-3xl text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center sm:justify-start gap-2">
              <AlertTriangle className="w-4 h-4" /> Emergency On-Site Safety
            </h4>
            <p className="text-xs text-slate-300">
              For urgent safety issues during active job execution, dial <code>{emergencyContact}</code> immediately for rapid escalation.
            </p>
          </div>
          <a
            href={`tel:${supportPhone.replace(/[^0-9+]/g, '')}`}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex-shrink-0"
          >
            Emergency Call 📞
          </a>
        </div>

      </div>

      {/* Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">Raise Support Ticket</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Issue Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {ticketCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="Short title of your issue (e.g. Payment deducted twice)"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  required
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide detailed information including booking ID or transaction reference..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1D2B83] hover:bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
};

export default SupportPage;
