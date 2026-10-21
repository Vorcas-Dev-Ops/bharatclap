"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import {
  Smartphone,
  Users,
  Tag,
  Link,
  Calendar,
  Clock,
  Image as ImageIcon,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  Info,
  ChevronRight,
  Volume2,
  VolumeX,
  Bell
} from 'lucide-react';
import TestNotificationModal from './TestNotificationModal';
import ConfirmSendModal from './ConfirmSendModal';

const SOUND_OPTIONS = [
  { value: 'default', label: 'Default', desc: 'Standard system chime' },
  { value: 'bharatclap_alert', label: 'BharatClap Alert', desc: 'Upbeat branded chime for bookings & promotions' },
  { value: 'partner_job_alert', label: 'Partner Job Alert', desc: 'High-priority alert tone for partner leads' },
  { value: 'silent', label: 'Silent', desc: 'Silent notification (no sound or vibration)' },
];

const NOTIFICATION_TYPES = [
  { value: 'MARKETING', label: 'Marketing', desc: 'Campaigns, seasonal sales & offers' },
  { value: 'PROMOTIONAL', label: 'Promotional', desc: 'Discounts, cashbacks & coupons' },
  { value: 'ANNOUNCEMENT', label: 'Announcement', desc: 'App news, policy changes & events' },
  { value: 'SYSTEM', label: 'System Alert', desc: 'Maintenance, updates & critical alerts' },
  { value: 'TRANSACTIONAL', label: 'Transactional', desc: 'Order receipts & account actions' },
  { value: 'BOOKING', label: 'Booking', desc: 'Booking confirmed, provider assigned' },
  { value: 'JOB', label: 'Job Alert', desc: 'Partner job requests & assignments' },
  { value: 'PAYMENT', label: 'Payment', desc: 'Settlements, payout & wallet updates' },
];

const ACTION_TYPES = [
  { value: 'open_home', label: 'Open Home Screen' },
  { value: 'open_service', label: 'Open Specific Service' },
  { value: 'open_category', label: 'Open Category' },
  { value: 'open_offer', label: 'Open Offers & Coupons' },
  { value: 'open_booking', label: 'Open My Bookings' },
  { value: 'open_wallet', label: 'Open Wallet / Balance' },
  { value: 'open_profile', label: 'Open User Profile' },
  { value: 'open_orders', label: 'Open Orders' },
  { value: 'external_url', label: 'External Website URL' },
  { value: 'none', label: 'No Action (Notification Only)' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users / Providers', desc: 'Reach everyone on the selected app' },
  { value: 'active', label: 'Active Users', desc: 'Users active within last 30 days' },
  { value: 'new', label: 'New Users', desc: 'Registered in the last 7 days' },
  { value: 'inactive', label: 'Inactive / Dormant', desc: 'No bookings in 30+ days' },
  { value: 'bangalore', label: 'Bangalore City', desc: 'Users/providers located in Bangalore' },
];

interface NotificationComposerProps {
  initialData?: any;
  onSuccess?: () => void;
}

export default function NotificationComposer({ initialData, onSuccess }: NotificationComposerProps) {
  const [app, setApp] = useState<'customer' | 'partner' | 'both'>('customer');
  const [audience, setAudience] = useState<string>('all');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [type, setType] = useState<string>('MARKETING');
  const [actionType, setActionType] = useState<string>('open_home');
  const [actionValue, setActionValue] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sound, setSound] = useState<string>('default');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [scheduledTime, setScheduledTime] = useState<string>('');

  const [estimate, setEstimate] = useState<number>(0);
  const [estimating, setEstimating] = useState<boolean>(false);

  // Modals state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Populate from initialData if passed (e.g. from template or draft)
  useEffect(() => {
    if (initialData) {
      if (initialData.app) setApp(initialData.app);
      if (initialData.audience) setAudience(initialData.audience);
      if (initialData.title) setTitle(initialData.title);
      if (initialData.message) setMessage(initialData.message);
      if (initialData.type) setType(initialData.type);
      if (initialData.action_type) setActionType(initialData.action_type);
      if (initialData.action_value) setActionValue(initialData.action_value);
      if (initialData.image_url) setImageUrl(initialData.image_url);
      if (initialData.sound_enabled !== undefined) setSoundEnabled(initialData.sound_enabled);
      if (initialData.sound) setSound(initialData.sound);
      if (initialData.scheduled_at) {
        setIsScheduled(true);
        const dt = new Date(initialData.scheduled_at);
        setScheduledDate(dt.toISOString().split('T')[0]);
        setScheduledTime(dt.toTimeString().slice(0, 5));
      }
    }
  }, [initialData]);

  // Fetch estimate whenever app or audience changes
  useEffect(() => {
    fetchEstimate();
  }, [app, audience]);

  const fetchEstimate = async () => {
    try {
      setEstimating(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/campaigns/estimate?app=${app}&audience=${audience}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEstimate(res.data?.estimated_recipients || 0);
    } catch (err) {
      console.warn('Could not estimate reach:', err);
      setEstimate(0);
    } finally {
      setEstimating(false);
    }
  };

  const validate = () => {
    if (!title.trim()) {
      setFeedback({ type: 'error', message: 'Notification title is required.' });
      return false;
    }
    if (!message.trim()) {
      setFeedback({ type: 'error', message: 'Notification message is required.' });
      return false;
    }
    if (isScheduled) {
      if (!scheduledDate || !scheduledTime) {
        setFeedback({ type: 'error', message: 'Please select both date and time for scheduled notifications.' });
        return false;
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (scheduledDateTime.getTime() <= Date.now()) {
        setFeedback({ type: 'error', message: 'Scheduled time must be in the future.' });
        return false;
      }
    }
    setFeedback(null);
    return true;
  };

  const getScheduledIso = () => {
    if (!isScheduled || !scheduledDate || !scheduledTime) return undefined;
    return new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
  };

  const handleSaveDraft = async () => {
    if (!title.trim() && !message.trim()) {
      setFeedback({ type: 'error', message: 'Please provide at least a title or message to save a draft.' });
      return;
    }
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const payload = {
        title: title.trim() || 'Untitled Draft',
        message: message.trim() || '',
        app,
        audience,
        type,
        action_type: actionType,
        action_value: actionValue.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        sound_enabled: soundEnabled,
        sound: soundEnabled ? sound : 'silent',
        status: 'draft',
        scheduled_at: getScheduledIso()
      };

      await axios.post(`${API_URL}/notifications/campaigns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFeedback({ type: 'success', message: 'Draft saved successfully!' });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to save draft' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBroadcastConfirmed = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const payload = {
        title: title.trim(),
        message: message.trim(),
        app,
        audience,
        type,
        action_type: actionType,
        action_value: actionValue.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        sound_enabled: soundEnabled,
        sound: soundEnabled ? sound : 'silent',
        scheduled_at: getScheduledIso()
      };

      await axios.post(`${API_URL}/notifications/campaigns`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIsConfirmModalOpen(false);
      setFeedback({
        type: 'success',
        message: isScheduled ? 'Notification campaign scheduled successfully!' : 'Notification broadcast dispatched successfully!'
      });

      // Clear form
      setTitle('');
      setMessage('');
      setImageUrl('');
      setActionValue('');
      setIsScheduled(false);

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to send notification' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Composer Form */}
      <div className="lg:col-span-7 space-y-6">
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-start space-x-3 text-sm border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section 1: Target App & Audience */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">1. Target Audience</h3>
          </div>

          {/* App Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
              Select Target Application
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'customer', label: 'Customer App', icon: Smartphone, desc: 'BharatClap Customer' },
                { id: 'partner', label: 'Partner App', icon: Smartphone, desc: 'BharatClap Partner / Pro' },
                { id: 'both', label: 'Both Apps', icon: Users, desc: 'All customers & partners' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setApp(opt.id as any)}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    app === opt.id
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={`font-bold text-sm ${app === opt.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {opt.label}
                    </span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                        app === opt.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    >
                      {app === opt.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audience Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
              Recipient Segment / Filter
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AUDIENCE_OPTIONS.map((aud) => (
                <button
                  key={aud.value}
                  type="button"
                  onClick={() => setAudience(aud.value)}
                  className={`p-3 rounded-xl border text-left transition flex items-start justify-between ${
                    audience === aud.value
                      ? 'border-indigo-600 bg-indigo-50/40 font-medium'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800">{aud.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{aud.desc}</div>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 mt-0.5 rounded-full border flex-shrink-0 flex items-center justify-center ${
                      audience === aud.value ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {audience === aud.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Estimated Reach Banner */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Calculated Audience Reach:</span>
            </div>
            <div className="text-sm font-bold text-slate-900">
              {estimating ? (
                <span className="text-slate-400 text-xs">Estimating...</span>
              ) : (
                <span>~{estimate.toLocaleString()} devices</span>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Notification Content */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Tag className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">2. Message Content</h3>
          </div>

          {/* Notification Type */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
              Notification Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {NOTIFICATION_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-2 rounded-lg border text-center text-xs font-semibold transition ${
                    type === t.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                  }`}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Title <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{title.length}/65 chars</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. AC Service Offer 🔥 Flat ₹200 OFF"
              maxLength={65}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
            />
          </div>

          {/* Message Body */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Message Body <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{message.length}/240 chars</span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Beat the summer heat! Get complete AC servicing at doorstep by certified experts. Book today using code AC200."
              rows={3}
              maxLength={240}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 resize-none"
            />
          </div>

          {/* Image URL */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Image / Banner URL (Optional)
              </label>
              <span className="text-[11px] text-slate-400">Recommended 1024×512 px (Max 1MB)</span>
            </div>
            <div className="flex space-x-2">
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/... or /images/offers/ac.png"
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
              />
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Deep Link / Action */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Link className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">3. Tap Action & Deep Link</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1.5">
                Action on Tap
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 font-medium"
              >
                {ACTION_TYPES.map((act) => (
                  <option key={act.value} value={act.value}>
                    {act.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Value Input (Service / Category / URL) */}
            {['open_service', 'open_category', 'external_url'].includes(actionType) && (
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1.5">
                  {actionType === 'open_service' && 'Service ID or Slug'}
                  {actionType === 'open_category' && 'Category ID or Slug'}
                  {actionType === 'external_url' && 'Target Web URL'}
                </label>
                <input
                  type="text"
                  value={actionValue}
                  onChange={(e) => setActionValue(e.target.value)}
                  placeholder={
                    actionType === 'open_service'
                      ? 'e.g. ac-service-repair'
                      : actionType === 'open_category'
                      ? 'e.g. appliance-repair'
                      : 'https://bharatclap.com/festival'
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900"
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Notification Sound */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-base">4. Notification Sound</h3>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 transition">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-slate-700">Play sound</span>
            </label>
          </div>

          {soundEnabled ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Select Approved Audio Profile
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SOUND_OPTIONS.map((opt) => {
                  const isSelected = sound === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`relative flex items-start p-3.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="sound_option"
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => setSound(opt.value)}
                        className="mt-0.5 w-4 h-4 text-indigo-600 focus:ring-indigo-500 shrink-0"
                      />
                      <div className="ml-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                          {opt.value === 'job_alert' && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              Partner Alert
                            </span>
                          )}
                          {opt.value === 'silent' && (
                            <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                              Muted
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 flex items-center space-x-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  Sound profiles are controlled and mapped to native Android Notification Channels & iOS APNs to ensure predictable delivery.
                </span>
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3 text-slate-600 text-xs">
              <VolumeX className="w-5 h-5 text-slate-400 shrink-0" />
              <span>
                Notification will be delivered silently to the mobile notification tray with no audible chime or vibration.
              </span>
            </div>
          )}
        </div>

        {/* Section 5: Scheduling & Delivery Options */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-base">5. Delivery Timing</h3>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="radio"
                name="schedule_toggle"
                checked={!isScheduled}
                onChange={() => setIsScheduled(false)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-800">Send Immediately</span>
            </label>

            <label className="flex items-center space-x-2.5 cursor-pointer">
              <input
                type="radio"
                name="schedule_toggle"
                checked={isScheduled}
                onChange={() => setIsScheduled(true)}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-800">Schedule for Later</span>
            </label>
          </div>

          {isScheduled && (
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date (Asia/Kolkata)</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <p className="text-[11px] text-indigo-700 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Notifications are scheduled based on Indian Standard Time (IST / UTC+05:30).</span>
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!title.trim() || !message.trim()) {
                  setFeedback({ type: 'error', message: 'Please enter title and message to test dispatch.' });
                  return;
                }
                setIsTestModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition shadow-sm"
            >
              <Smartphone className="w-4 h-4 text-indigo-600" />
              <span>Send Test Notification</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (validate()) {
                setIsConfirmModalOpen(true);
              }
            }}
            disabled={isSubmitting}
            className="flex items-center space-x-2 px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition shadow-md hover:shadow-indigo-500/25 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isScheduled ? 'Schedule Broadcast' : 'Send to Audience'}</span>
          </button>
        </div>
      </div>

      {/* Right Column: Mobile Device Live Preview */}
      <div className="lg:col-span-5 space-y-4">
        <div className="sticky top-24">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Live Phone Mockup Preview</span>
            </div>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-medium">
              {app === 'partner' ? 'Partner App' : 'Customer App'}
            </span>
          </div>

          {/* Smartphone Frame */}
          <div className="mx-auto max-w-[340px] bg-slate-950 rounded-[44px] p-3 shadow-2xl border-4 border-slate-800">
            {/* Speaker & camera notch */}
            <div className="w-28 h-4 bg-slate-900 rounded-full mx-auto mb-3 flex items-center justify-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
              <div className="w-8 h-1 rounded-full bg-slate-800" />
            </div>

            {/* Screen Content */}
            <div className="bg-slate-900 rounded-[32px] p-4 min-h-[460px] flex flex-col justify-start text-white relative overflow-hidden">
              {/* Status bar */}
              <div className="flex justify-between items-center text-[11px] text-slate-400 mb-6 px-1">
                <span>09:41</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px]">5G</span>
                  <div className="w-4 h-2 border border-slate-400 rounded-sm p-0.5">
                    <div className="w-full h-full bg-white rounded-xs" />
                  </div>
                </div>
              </div>

              {/* Notification Banner / Lockscreen Card */}
              <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3.5 shadow-xl space-y-2.5 transition-all">
                {/* App Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] ${
                        app === 'partner' ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600 text-white'
                      }`}
                    >
                      BC
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-200">
                        {app === 'partner' ? 'BharatClap Partner' : 'BharatClap'}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1.5">• Now</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider bg-slate-700/50 px-1.5 py-0.5 rounded">
                    {type}
                  </span>
                </div>

                {/* Content */}
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight">
                    {title || 'Notification Title Preview'}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                    {message || 'The notification message body will be rendered here as the customer or partner sees it on their mobile device.'}
                  </p>
                </div>

                {/* Media preview if provided */}
                {imageUrl && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-700 max-h-36 bg-slate-950">
                    <img
                      src={imageUrl}
                      alt="Notification media"
                      className="w-full h-auto object-cover max-h-36"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Action Deep-link Chip */}
                {actionType !== 'none' && (
                  <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-indigo-300">
                    <span className="font-semibold flex items-center space-x-1">
                      <span>Action:</span>
                      <span className="text-white capitalize">
                        {actionType.replace(/open_/g, '').replace(/_/g, ' ')}
                      </span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                )}

                {/* Sound & Channel Indicator */}
                <div className="pt-2 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center space-x-1.5">
                    {soundEnabled && sound !== 'silent' ? (
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    )}
                    <span className="text-slate-300">
                      {soundEnabled && sound !== 'silent'
                        ? sound === 'job_alert'
                          ? 'Partner Job Alert'
                          : sound === 'booking'
                          ? 'BharatClap Alert'
                          : 'Default Chime'
                        : 'Silent Alert'}
                    </span>
                  </span>
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider font-mono">
                    {soundEnabled && sound !== 'silent'
                      ? sound === 'job_alert'
                        ? 'partner_jobs'
                        : 'general'
                      : 'silent'}
                  </span>
                </div>
              </div>

              {/* Decorative wallpaper subtle text */}
              <div className="mt-auto text-center pb-4 text-slate-600 text-xs font-medium">
                Tap notification to launch BharatClap
              </div>
            </div>

            {/* Bottom Home indicator */}
            <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
          </div>

          <div className="text-center text-xs text-slate-400 mt-3">
            Interactive preview conforms to Android 13+ & iOS notification styling
          </div>
        </div>
      </div>

      {/* Test Notification Modal */}
      <TestNotificationModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        notificationData={{
          title,
          message,
          app,
          type,
          action_type: actionType,
          action_value: actionValue,
          image_url: imageUrl,
          sound_enabled: soundEnabled,
          sound: soundEnabled ? sound : 'silent',
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmSendModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleBroadcastConfirmed}
        isSending={isSubmitting}
        data={{
          app,
          audience,
          title,
          message,
          type,
          action_type: actionType,
          action_value: actionValue,
          image_url: imageUrl,
          sound_enabled: soundEnabled,
          sound: soundEnabled ? sound : 'silent',
          is_scheduled: isScheduled,
          scheduled_at: getScheduledIso(),
          recipient_count: estimate
        }}
      />
    </div>
  );
}
