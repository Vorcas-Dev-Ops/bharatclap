"use client";

import React, { useState, useRef, useEffect } from "react";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import {
  Search, HelpCircle, MessageCircle, Phone, Mail,
  Calendar, CreditCard, RefreshCw, XCircle, Star,
  ChevronDown, ChevronUp, ExternalLink, Clock,
  CheckCircle, AlertCircle, Ticket, Send, X, Bot, User
} from "lucide-react";

/* ─────────────────────────────── constants ─────────────────────────────── */

// ✅ Replace with your real WhatsApp support number (country code, no + or spaces)
const WHATSAPP_NUMBER = "919876543210";
const WHATSAPP_MESSAGE = encodeURIComponent(
  "Hello FIXVO Support! I need help with my query."
);

// ✅ Replace with your real support email
const SUPPORT_EMAIL = "fixvoadmin@gmail.com";
const EMAIL_SUBJECT = encodeURIComponent("FIXVO Support Request");
const EMAIL_BODY = encodeURIComponent(
  "Hello FIXVO Team,\n\nI need assistance with:\n\n[Describe your issue here]\n\nThank you."
);

/* ─────────────────────────────── data ──────────────────────────────────── */

const quickCategories = [
  { icon: Calendar, label: "Booking Issues",  color: "bg-blue-100 text-blue-600" },
  { icon: CreditCard, label: "Payment Issues", color: "bg-violet-100 text-violet-600" },
  { icon: Star,       label: "Provider Issues", color: "bg-amber-100 text-amber-600" },
  { icon: RefreshCw,  label: "Refund Issues",  color: "bg-emerald-100 text-emerald-600" },
  { icon: XCircle,    label: "Cancellations",  color: "bg-red-100 text-red-500" },
  { icon: HelpCircle, label: "Other Queries",  color: "bg-slate-100 text-slate-600" },
];

const faqs = [
  { q: "How do I cancel a booking?", a: "Go to My Bookings, select the booking, and tap 'Cancel'. Cancellations are free up to 1 hour before the scheduled service. Late cancellations may incur a ₹99 fee." },
  { q: "When will I get my refund?", a: "Refunds are processed within 3–5 business days for card payments. UPI refunds typically arrive in 1–2 business days." },
  { q: "Can I reschedule my booking?", a: "Yes! Open the booking in 'My Bookings' and tap 'Reschedule'. FIXVO Plus members get free rescheduling anytime." },
  { q: "How do I rate my service provider?", a: "After your service is completed, you'll receive a notification to rate your provider. You can also rate from the booking details page." },
  { q: "My provider didn't show up. What do I do?", a: "Please wait 15 minutes past the scheduled time, then tap 'Provider Not Arrived' in your booking. We'll escalate immediately and offer a full refund or re-booking." },
  { q: "How do I apply a coupon code?", a: "During checkout, you'll see a 'Apply Coupon' field. Enter your code and it will be applied to your order total." },
];

const myTickets = [
  { id: "TKT-001", subject: "Refund for booking #BK002", status: "resolved", date: "8 May 2026" },
  { id: "TKT-002", subject: "Provider was late by 2 hrs",  status: "open",     date: "11 May 2026" },
];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  open:     { color: "text-amber-700",   bg: "bg-amber-100",   icon: Clock,         label: "Open" },
  resolved: { color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle,   label: "Resolved" },
  pending:  { color: "text-blue-700",    bg: "bg-blue-100",    icon: AlertCircle,   label: "Pending" },
};

/* ─────────────────────── chatbot bot-reply logic ───────────────────────── */

interface ChatMessage {
  from: "user" | "bot";
  text: string;
  time: string;
}

function getBotReply(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("cancel"))      return "You can cancel a booking from 'My Bookings'. Cancellations within 1 hour of the service may incur a ₹99 fee. Would you like me to raise a cancellation request for you?";
  if (m.includes("refund"))      return "Refunds are processed within 3–5 business days for cards and 1–2 days for UPI. Can you share your booking ID so I can check the status?";
  if (m.includes("reschedule"))  return "Sure! To reschedule, open 'My Bookings', choose the booking, and tap 'Reschedule'. FIXVO Plus members get free rescheduling. Shall I help you pick a new slot?";
  if (m.includes("payment") || m.includes("paid")) return "Payment issues are usually resolved within 24 hours. Please share your Transaction ID or Booking ID and I'll look into it right away.";
  if (m.includes("provider"))    return "Sorry to hear that! Can you tell me more — did the provider not arrive, or was there a quality issue? This will help me escalate your concern.";
  if (m.includes("coupon") || m.includes("offer") || m.includes("discount")) return "Coupons can be applied at checkout. If a valid coupon is not working, share the code with me and I'll verify it for you.";
  if (m.includes("hello") || m.includes("hi") || m.includes("hey")) return "Hello! 👋 I'm the FIXVO Support Assistant. How can I help you today?";
  if (m.includes("thank"))       return "You're welcome! 😊 Is there anything else I can help you with?";
  if (m.includes("bye") || m.includes("goodbye")) return "Goodbye! Have a great day. Don't hesitate to reach out if you need anything. 👋";
  return "I understand your concern. Let me connect you with our support team for a more detailed resolution. Can you describe your issue in a bit more detail?";
}

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/* ─────────────────────────── LiveChat component ────────────────────────── */

const LiveChatModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "bot", text: "Hello! 👋 Welcome to FIXVO Support. I'm here to help you. How can I assist you today?", time: nowTime() },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = { from: "user", text: trimmed, time: nowTime() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      const reply = getBotReply(trimmed);
      setMessages(prev => [...prev, { from: "bot", text: reply, time: nowTime() }]);
      setTyping(false);
    }, 1200 + Math.random() * 800);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
    >
      {/* Modal */}
      <div className="relative w-full sm:w-[420px] h-[550px] sm:h-[600px] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden animate-slideUp">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-[#1D2B83] to-[#3B4FD8] flex-shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-white">FIXVO Support</p>
            <p className="text-[11px] text-blue-200 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              Online · Avg reply 2 min
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F7FF]">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : "flex-row"}`}>
              {m.from === "bot"
                ? <div className="w-7 h-7 rounded-xl bg-[#1D2B83] flex items-center justify-center flex-shrink-0 mt-1"><Bot className="w-3.5 h-3.5 text-white" /></div>
                : <div className="w-7 h-7 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0 mt-1"><User className="w-3.5 h-3.5 text-slate-500" /></div>
              }
              <div className={`max-w-[75%] ${m.from === "user" ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                  m.from === "user"
                    ? "bg-[#1D2B83] text-white rounded-tr-sm"
                    : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                }`}>
                  {m.text}
                </div>
                <span className="text-[10px] text-slate-400 font-medium px-1">{m.time}</span>
              </div>
            </div>
          ))}

          {typing && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-xl bg-[#1D2B83] flex items-center justify-center flex-shrink-0"><Bot className="w-3.5 h-3.5 text-white" /></div>
              <div className="bg-white border border-slate-100 shadow-sm px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions - Fixed at bottom above input */}
        <div className="px-4 py-3 bg-white border-t border-slate-50 flex flex-wrap gap-2 flex-shrink-0">
          <button
            onClick={() => { setInput("Cancel booking"); }}
            className="flex-1 min-w-[120px] text-[11px] font-black px-3 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <XCircle className="w-3 h-3" /> Cancel booking
          </button>
          <div className="flex gap-2 w-full overflow-x-auto scrollbar-none pb-0.5">
            {["Refund status", "Reschedule", "Payment issue"].map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="flex-shrink-0 text-[11px] font-black px-3 py-2 rounded-xl bg-blue-50 text-[#1D2B83] hover:bg-blue-100 transition-colors border border-blue-100"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-4 bg-white border-t border-slate-100 flex gap-2 items-center flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#1D2B83] focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-11 h-11 rounded-2xl bg-[#1D2B83] flex items-center justify-center text-white hover:bg-[#2a3da8] disabled:opacity-40 transition-all flex-shrink-0 shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
};

/* ─────────────────────────── main page ─────────────────────────────────── */

const SupportPage = () => {
  const [openFaq, setOpenFaq]     = useState<number | null>(null);
  const [query, setQuery]         = useState("");
  const [chatOpen, setChatOpen]   = useState(false);

  const filtered = faqs.filter(f =>
    f.q.toLowerCase().includes(query.toLowerCase()) ||
    f.a.toLowerCase().includes(query.toLowerCase())
  );

  /* ── handler helpers ── */
  const handleLiveChat = () => setChatOpen(true);

  const handleCallNow = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSendEmail = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${EMAIL_SUBJECT}&body=${EMAIL_BODY}`;
    window.open(gmailUrl, "_blank", "noopener,noreferrer");
  };



  const contactOptions = [
    {
      icon: MessageCircle,
      label: "Live Chat",
      sub: "Avg reply: 2 min",
      cta: "Start Chat",
      color: "text-emerald-600",
      bg: "bg-emerald-100",
      action: handleLiveChat,
    },
    {
      icon: Phone,
      label: "Call Support",
      sub: "Mon–Sat, 9am–7pm",
      cta: "Call Now",
      color: "text-blue-600",
      bg: "bg-blue-100",
      action: handleCallNow,
    },
    {
      icon: Mail,
      label: "Email Us",
      sub: "Reply within 24 hrs",
      cta: "Send Email",
      color: "text-violet-600",
      bg: "bg-violet-100",
      action: handleSendEmail,
    },
  ];

  return (
    <main className="min-h-screen bg-[#F0F4FF]">
      <Navbar />

      {chatOpen && <LiveChatModal onClose={() => setChatOpen(false)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div>
          <h1 className="text-3xl font-black text-center text-slate-900 tracking-tight">Help &amp; Support</h1>
          <p className="text-slate-500 text-center mt-1 font-medium">We're here to help. Let us know what's wrong.</p>
        </div>

        <div className="relative max-w-2xl mx-auto w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search your question..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:border-[#1D2B83] focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
          />
        </div>

        <div>
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-5 ml-1">What do you need help with?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {quickCategories.map(c => (
              <button key={c.label} className="bg-white rounded-3xl p-6 flex flex-col items-center gap-3 border border-slate-100 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${c.color} group-hover:scale-110 transition-transform shadow-sm`}>
                  <c.icon className="w-7 h-7" />
                </div>
                <span className="text-xs font-black text-slate-700 text-center leading-tight">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Contact Support ── */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-blue-900/5 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
            <h2 className="text-lg font-black text-slate-900">Contact Support</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {contactOptions.map(s => (
              <div key={s.label} className="p-8 flex flex-col items-center text-center gap-5 hover:bg-slate-50/80 transition-colors">
                <div className={`w-16 h-16 rounded-[24px] ${s.bg} flex items-center justify-center shadow-inner`}>
                  <s.icon className={`w-8 h-8 ${s.color}`} />
                </div>
                <div>
                  <p className="text-base font-black text-slate-800">{s.label}</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">{s.sub}</p>
                </div>
                <button
                  onClick={s.action}
                  className={`text-sm font-black px-6 py-3 rounded-2xl ${s.bg} ${s.color} hover:brightness-95 active:scale-95 transition-all flex items-center gap-2 shadow-sm`}
                >
                  {s.cta} <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQs ── */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-blue-900/5 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
            <h2 className="text-lg font-black text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {filtered.length === 0
              ? <p className="px-8 py-12 text-center text-slate-400 font-medium text-sm">No results found</p>
              : filtered.map((f, i) => (
                <div key={i} className="group">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-8 py-6 flex items-center justify-between gap-6 text-left hover:bg-slate-50/60 transition-all"
                  >
                    <span className="text-base font-bold text-slate-800 group-hover:text-[#1D2B83] transition-colors">{f.q}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${openFaq === i ? "bg-[#1D2B83] text-white rotate-0" : "bg-slate-100 text-slate-400"}`}>
                      {openFaq === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  {openFaq === i && (
                    <div className="px-8 pb-8 animate-fadeIn">
                      <div className="text-base text-slate-500 font-medium leading-relaxed border-l-4 border-blue-500/30 pl-6 bg-blue-50/30 py-5 pr-6 rounded-r-3xl">
                        {f.a}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* ── My Tickets ── */}
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-blue-900/5 overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-[#1D2B83]" />
              </div>
              My Tickets
            </h2>
            <button className="text-sm font-black text-[#1D2B83] bg-blue-50 px-5 py-2.5 rounded-2xl hover:bg-blue-100 transition-all active:scale-95">+ New Ticket</button>
          </div>
          <div className="divide-y divide-slate-50">
            {myTickets.map(t => {
              const s = statusConfig[t.status];
              const StatusIcon = s.icon;
              return (
                <div key={t.id} className="px-8 py-6 flex items-center gap-6 hover:bg-slate-50/50 transition-all group cursor-pointer">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${s.bg}`}>
                    <StatusIcon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-bold text-slate-800 group-hover:text-[#1D2B83] transition-colors">{t.subject}</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">{t.id} · {t.date}</p>
                  </div>
                  <span className={`text-xs font-black px-4 py-1.5 rounded-full shadow-sm ${s.bg} ${s.color}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Footer />
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </main>
  );
};

export default SupportPage;
