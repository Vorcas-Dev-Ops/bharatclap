"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  X,
  Send,
  Phone,
  Shield,
  User,
  Paperclip,
  CheckCheck,
  Check,
  Zap,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  Image as ImageIcon,
  FileText,
  Mic,
  MapPin,
  Camera,
  RotateCcw,
  Clock,
  Play,
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useChat, MediaAttachment } from '@/context/ChatContext';

interface LiveChatWidgetProps {
  embedded?: boolean;
  defaultRole?: 'customer' | 'provider' | 'admin';
}

export default function LiveChatWidget({ embedded = false, defaultRole }: LiveChatWidgetProps) {
  const {
    threads,
    activeThreadId,
    sendMessage,
    retryMessage,
    isWidgetOpen,
    setIsWidgetOpen,
    widgetRole,
    setWidgetRole,
  } = useChat();

  const [inputMessage, setInputMessage] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaAttachment | undefined>(undefined);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentRole = defaultRole || widgetRole;
  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages, activeThread?.isTypingProvider]);

  if (!activeThread) return null;

  const handleSend = () => {
    if (!inputMessage.trim() && !selectedMedia) return;

    let senderName = 'Customer';
    let senderId = 'cust_user';
    let senderRole: 'customer' | 'provider' | 'admin' = currentRole;

    if (isAdminMode || currentRole === 'admin') {
      senderRole = 'admin';
      senderName = 'Admin Support (Sumanth)';
      senderId = 'admin_01';
    } else if (currentRole === 'provider') {
      senderName = activeThread.provider?.name || 'Ramesh Kumar (Provider)';
      senderId = activeThread.provider?.id || 'prov_402';
    } else {
      senderName = activeThread.customer.name;
      senderId = activeThread.customer.id;
    }

    sendMessage(
      activeThread.id,
      inputMessage,
      senderRole,
      senderName,
      senderId,
      selectedMedia,
      isAdminMode
    );

    setInputMessage('');
    setSelectedMedia(undefined);
    setMediaPickerOpen(false);
  };

  const sendQuickReply = (text: string) => {
    setInputMessage(text);
  };

  // Quick Canned Responses per role
  const getCannedReplies = () => {
    if (isAdminMode || currentRole === 'admin') {
      return [
        'Admin Notice: Monitoring active session for SLA compliance.',
        'Support Agent assigned to assist customer.',
        'Refund request has been approved by Admin.',
      ];
    }
    if (currentRole === 'provider') {
      return [
        'I am on my way to your location.',
        'Please share the 4-digit start OTP.',
        'I have reached outside your gate.',
        'Service is completed. Thank you!',
      ];
    }
    return [
      'What is your expected arrival time?',
      'Please ring flat bell 302.',
      'Is any extra material needed for the service?',
      'Call me when you reach the landmark.',
    ];
  };

  const attachMedia = (type: MediaAttachment['type']) => {
    if (type === 'image') {
      setSelectedMedia({
        type: 'image',
        url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=500&auto=format&fit=crop&q=80',
        name: 'unit_inspect_photo.jpg',
        size: '2.4 MB',
      });
    } else if (type === 'pdf') {
      setSelectedMedia({
        type: 'pdf',
        url: '#',
        name: 'Service_Invoice_Estimate.pdf',
        size: '412 KB',
      });
    } else if (type === 'voice') {
      setSelectedMedia({
        type: 'voice',
        url: '#',
        duration: '0:14',
        name: 'Voice_Note_01.mp3',
      });
    } else if (type === 'location') {
      setSelectedMedia({
        type: 'location',
        url: '#',
        latLng: { lat: 12.9716, lng: 77.5946, address: 'Indiranagar 100ft Road, Bengaluru' },
      });
    } else if (type === 'booking_photo') {
      setSelectedMedia({
        type: 'booking_photo',
        url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500&auto=format&fit=crop&q=80',
        name: 'before_service_photo.jpg',
        size: '1.8 MB',
      });
    } else if (type === 'completion_photo') {
      setSelectedMedia({
        type: 'completion_photo',
        url: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=500&auto=format&fit=crop&q=80',
        name: 'after_service_photo.jpg',
        size: '2.1 MB',
      });
    }
    setMediaPickerOpen(false);
  };

  const renderContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-slate-800 relative">
      {/* Widget Header & Presence Status */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={
                currentRole === 'provider'
                  ? activeThread.customer.avatar || 'https://ui-avatars.com/api/?name=Customer'
                  : activeThread.provider?.avatar || 'https://ui-avatars.com/api/?name=Provider'
              }
              alt="Participant"
              className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/50"
            />
            <span
              className={`w-3 h-3 rounded-full absolute bottom-0 right-0 ring-2 ring-slate-950 ${
                (currentRole === 'provider' ? activeThread.customer.presence : activeThread.provider?.presence) === 'online'
                  ? 'bg-emerald-500'
                  : (currentRole === 'provider' ? activeThread.customer.presence : activeThread.provider?.presence) === 'on_booking'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">
                {currentRole === 'provider' ? activeThread.customer.name : activeThread.provider?.name || 'Support Desk'}
              </span>
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded text-[10px] font-mono uppercase">
                {activeThread.bookingId || 'SUPPORT'}
              </span>
            </div>

            {/* 4. Presence Display */}
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span className="text-emerald-400 font-semibold uppercase text-[10px]">
                ● {currentRole === 'provider' ? activeThread.customer.presence : activeThread.provider?.presence || 'online'}
              </span>
              <span>•</span>
              <span className="truncate">{currentRole === 'provider' ? activeThread.customer.lastSeen : activeThread.provider?.lastSeen}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Intervention Mode Toggle */}
          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition flex items-center gap-1 ${
              isAdminMode
                ? 'bg-gradient-to-r from-amber-500 to-purple-600 text-white border-amber-400 shadow-md animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Toggle Admin Eavesdrop & Intervention Mode"
          >
            <Shield className="w-3 h-3" />
            <span>{isAdminMode ? 'ADMIN MODE ON' : 'Admin Intervene'}</span>
          </button>

          {!embedded && (
            <button
              onClick={() => setIsWidgetOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Role Switcher & SLA Badge Banner */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-400">
            Role: <strong className="text-indigo-400 uppercase font-semibold">{currentRole}</strong>
          </span>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-mono font-bold">
            SLA: {activeThread.sla.status} ({activeThread.sla.firstResponseSec}s First Response)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWidgetRole('customer')}
            className={`px-2 py-0.5 rounded text-[10px] ${currentRole === 'customer' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Customer
          </button>
          <button
            onClick={() => setWidgetRole('provider')}
            className={`px-2 py-0.5 rounded text-[10px] ${currentRole === 'provider' ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Provider
          </button>
          <button
            onClick={() => setWidgetRole('admin')}
            className={`px-2 py-0.5 rounded text-[10px] ${currentRole === 'admin' ? 'bg-purple-600 text-white' : 'hover:bg-slate-800'}`}
          >
            Admin
          </button>
        </div>
      </div>

      {/* Message Stream Area with 10. Chat Timeline Events Interleaved */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 custom-scrollbar min-h-[280px]">
        {/* Render Timeline Events */}
        {activeThread.timelineEvents.map((ev) => (
          <div key={ev.id} className="flex justify-center my-2">
            <div className="bg-slate-950/80 border border-indigo-500/30 text-indigo-200 text-[10px] font-mono px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>{ev.timestamp}</span>
              <span>•</span>
              <span className="font-semibold text-white">{ev.title}</span>
            </div>
          </div>
        ))}

        {/* Render Messages */}
        {activeThread.messages.map((msg) => {
          const isMe =
            (currentRole === 'customer' && msg.senderRole === 'customer') ||
            (currentRole === 'provider' && msg.senderRole === 'provider') ||
            (currentRole === 'admin' && msg.senderRole === 'admin');

          const isAdminMsg = msg.senderRole === 'admin' || msg.isIntervention;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="text-[10px] text-slate-400 font-mono mb-1 flex items-center gap-1.5 px-1">
                <span>{msg.senderName}</span>
                <span>•</span>
                <span>{msg.timestamp}</span>
                {isAdminMsg && (
                  <span className="px-1.5 py-0.2 bg-purple-500/30 text-purple-300 border border-purple-400/40 rounded text-[9px] font-bold">
                    ADMIN INTERVENTION
                  </span>
                )}
                {msg.moderationFlag && (
                  <span className="px-1.5 py-0.2 bg-rose-500/30 text-rose-300 border border-rose-400/40 rounded text-[9px] font-bold">
                    AI FLAGGED ({msg.moderationFlag.reason})
                  </span>
                )}
              </div>

              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs shadow-md leading-relaxed ${
                  isAdminMsg
                    ? 'bg-gradient-to-r from-purple-900/90 to-indigo-900/90 text-purple-100 border border-purple-500/40 shadow-purple-950/50'
                    : isMe
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                }`}
              >
                <p>{msg.text}</p>

                {/* 1. Media Attachments Display */}
                {msg.media && (
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                    {msg.media.type === 'image' && (
                      <img src={msg.media.url} alt="Attachment" className="rounded-xl max-h-40 w-full object-cover border border-slate-700" />
                    )}

                    {msg.media.type === 'booking_photo' && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Before Service Inspection Photo
                        </span>
                        <img src={msg.media.url} alt="Booking Photo" className="rounded-xl max-h-40 w-full object-cover border border-amber-500/30" />
                      </div>
                    )}

                    {msg.media.type === 'completion_photo' && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Service Completion Proof Photo
                        </span>
                        <img src={msg.media.url} alt="Completion Photo" className="rounded-xl max-h-40 w-full object-cover border border-emerald-500/30" />
                      </div>
                    )}

                    {msg.media.type === 'pdf' && (
                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-700 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-rose-400" />
                          <div>
                            <div className="font-bold text-white text-[11px]">{msg.media.name}</div>
                            <div className="text-[9px] text-slate-400 font-mono">{msg.media.size}</div>
                          </div>
                        </div>
                        <Download className="w-3.5 h-3.5 text-slate-300 hover:text-white cursor-pointer" />
                      </div>
                    )}

                    {msg.media.type === 'voice' && (
                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-700 flex items-center gap-3">
                        <button
                          onClick={() => setIsPlayingVoice(!isPlayingVoice)}
                          className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-500 transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex-1">
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full bg-indigo-500 ${isPlayingVoice ? 'w-3/4 animate-pulse' : 'w-1/4'}`} />
                          </div>
                          <span className="text-[9px] font-mono text-slate-400 mt-1 block">Voice Note ({msg.media.duration})</span>
                        </div>
                      </div>
                    )}

                    {msg.media.type === 'location' && msg.media.latLng && (
                      <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-700 space-y-1 text-xs">
                        <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5" /> Shared Live GPS Location
                        </div>
                        <div className="text-[10px] text-slate-300">{msg.media.latLng.address}</div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          Lat: {msg.media.latLng.lat}, Lng: {msg.media.latLng.lng}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Detailed Message Status Indicators */}
              <div className="text-[9px] text-slate-500 mt-1 px-1 flex items-center gap-1 font-mono">
                {msg.status === 'read' ? (
                  <span className="text-indigo-400 font-bold flex items-center gap-0.5">
                    <CheckCheck className="w-3 h-3 text-indigo-400" /> Read
                  </span>
                ) : msg.status === 'delivered' ? (
                  <span className="text-slate-300 font-bold flex items-center gap-0.5">
                    <CheckCheck className="w-3 h-3 text-slate-400" /> Delivered
                  </span>
                ) : msg.status === 'failed' ? (
                  <span className="text-rose-400 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Failed
                    <button onClick={() => retryMessage(activeThread.id, msg.id)} className="underline text-indigo-300 ml-1">
                      Retry
                    </button>
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-0.5">
                    <Check className="w-3 h-3 text-slate-500" /> Sent
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* 3. Typing Indicator */}
        {((currentRole === 'customer' && activeThread.isTypingProvider) ||
          (currentRole === 'provider' && activeThread.isTypingCustomer)) && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono italic px-2 py-1 bg-slate-950/60 rounded-xl border border-slate-800 w-fit">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>{currentRole === 'customer' ? 'Provider is typing...' : 'Customer is typing...'}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Attachment Preview Strip */}
      {selectedMedia && (
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
            <span>Attached: <strong>{selectedMedia.type.toUpperCase()}</strong> ({selectedMedia.name || 'GPS Location'})</span>
          </div>
          <button onClick={() => setSelectedMedia(undefined)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Canned Quick Replies */}
      <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        {getCannedReplies().map((reply, i) => (
          <button
            key={i}
            onClick={() => sendQuickReply(reply)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] rounded-lg border border-slate-700 whitespace-nowrap transition"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Input Bar & Media Picker Drawer */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2 relative">
        <button
          onClick={() => setMediaPickerOpen(!mediaPickerOpen)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          title="Attach Media, Voice, Location, or Photos"
        >
          <Paperclip className="w-4 h-4 text-indigo-400" />
        </button>

        {/* Media Picker Popup Menu */}
        {mediaPickerOpen && (
          <div className="absolute bottom-14 left-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 w-48 text-xs text-slate-200">
            <button onClick={() => attachMedia('image')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <ImageIcon className="w-4 h-4 text-emerald-400" /> Send Image
            </button>
            <button onClick={() => attachMedia('pdf')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <FileText className="w-4 h-4 text-rose-400" /> Send PDF Invoice
            </button>
            <button onClick={() => attachMedia('voice')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <Mic className="w-4 h-4 text-amber-400" /> Voice Note (14s)
            </button>
            <button onClick={() => attachMedia('location')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <MapPin className="w-4 h-4 text-indigo-400" /> Share Live Location
            </button>
            <button onClick={() => attachMedia('booking_photo')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <Camera className="w-4 h-4 text-cyan-400" /> Before Service Photo
            </button>
            <button onClick={() => attachMedia('completion_photo')} className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg text-left">
              <CheckCircle className="w-4 h-4 text-emerald-400" /> Completion Photo
            </button>
          </div>
        )}

        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={isAdminMode ? 'Type as Admin Intervener...' : `Message ${currentRole === 'provider' ? 'Customer' : 'Provider'}...`}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
        />

        <button
          onClick={handleSend}
          className={`p-2.5 rounded-xl text-white font-semibold transition flex items-center justify-center shadow-lg ${
            isAdminMode
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'
              : 'bg-indigo-600 hover:bg-indigo-500'
          }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return renderContent();
  }

  return (
    <>
      {/* Floating Toggle Trigger Button */}
      {!isWidgetOpen && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsWidgetOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white p-4 rounded-full shadow-2xl border border-indigo-400/40 flex items-center gap-2.5 transition transform hover:scale-105"
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs font-bold pr-1 hidden sm:inline">Live Chat & Support</span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
        </motion.button>
      )}

      {/* Floating Chat Modal */}
      <AnimatePresence>
        {isWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-full max-w-sm sm:max-w-md h-[540px]"
          >
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
