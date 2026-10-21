"use client";

import React from 'react';
import Modal from '../common/Modal';
import { AlertTriangle, Send, Calendar, Users, Smartphone, Link, Image as ImageIcon, Tag, Volume2, VolumeX } from 'lucide-react';

interface ConfirmSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSending: boolean;
  data: {
    app: string;
    audience: string;
    audienceFilter?: string;
    title: string;
    message: string;
    type: string;
    action_type: string;
    action_value?: string;
    image_url?: string;
    sound_enabled?: boolean;
    sound?: string;
    is_scheduled: boolean;
    scheduled_at?: string;
    recipient_count?: number;
  };
}

export default function ConfirmSendModal({
  isOpen,
  onClose,
  onConfirm,
  isSending,
  data
}: ConfirmSendModalProps) {
  const getAppLabel = (app: string) => {
    switch (app) {
      case 'customer': return 'Customer App';
      case 'partner': return 'Partner App';
      case 'both': return 'Customer & Partner Apps';
      default: return app;
    }
  };

  const getAudienceLabel = (aud: string, filter?: string) => {
    if (filter) return filter.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    switch (aud) {
      case 'all': return 'All Users / Providers';
      case 'active': return 'Active Users / Providers';
      case 'inactive': return 'Inactive / Dormant Users';
      case 'new': return 'New Users (Last 7 Days)';
      case 'bangalore': return 'Bangalore City Users';
      default: return aud;
    }
  };

  const getActionLabel = (act: string, val?: string) => {
    const formatted = act.replace(/open_/g, '').replace(/_/g, ' ').toUpperCase();
    return val ? `${formatted}: ${val}` : formatted;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Notification Broadcast" size="md">
      <div className="space-y-5 py-1">
        <div className="flex items-start space-x-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-semibold block text-amber-900 mb-0.5">Please review before sending</span>
            {data.is_scheduled
              ? "This notification will be queued and dispatched at the scheduled time to all matching devices."
              : "This notification will be dispatched immediately via FCM and recorded across user devices. This action cannot be undone."}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 divide-y divide-slate-200 text-sm">
          <div className="pb-3">
            <span className="text-xs uppercase font-semibold text-slate-500 tracking-wider">Title</span>
            <p className="font-semibold text-slate-900 text-base mt-0.5">{data.title}</p>
            <p className="text-slate-600 text-xs mt-1 line-clamp-2">{data.message}</p>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              <Smartphone className="w-4 h-4 text-slate-400" />
              <span>Target App</span>
            </div>
            <span className="font-semibold text-slate-800 text-xs bg-white px-2.5 py-1 rounded border border-slate-200">
              {getAppLabel(data.app)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Audience Target</span>
            </div>
            <span className="font-medium text-slate-800 text-xs">
              {getAudienceLabel(data.audience, data.audienceFilter)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>Notification Type</span>
            </div>
            <span className="font-semibold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              {data.type}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              <Link className="w-4 h-4 text-slate-400" />
              <span>Action / Deep Link</span>
            </div>
            <span className="font-medium text-slate-800 text-xs max-w-[200px] truncate text-right">
              {getActionLabel(data.action_type, data.action_value)}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>Dispatch Timing</span>
            </div>
            <span className={`font-semibold text-xs ${data.is_scheduled ? 'text-amber-700' : 'text-emerald-700'}`}>
              {data.is_scheduled && data.scheduled_at
                ? new Date(data.scheduled_at).toLocaleString()
                : 'Immediately'}
            </span>
          </div>

          <div className="py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-600 text-xs font-medium">
              {data.sound_enabled === false || data.sound === 'silent' ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-indigo-500" />
              )}
              <span>Alert Sound</span>
            </div>
            <span className="font-semibold text-xs text-slate-800">
              {data.sound_enabled === false || data.sound === 'silent'
                ? 'Silent (No Sound)'
                : data.sound === 'partner_job_alert' || data.sound === 'job_alert'
                ? 'Partner Job Alert'
                : data.sound === 'bharatclap_alert' || data.sound === 'booking'
                ? 'BharatClap Alert'
                : 'Default System Chime'}
            </span>
          </div>

          {data.recipient_count !== undefined && (
            <div className="pt-2.5 flex items-center justify-between bg-blue-50/50 -mx-4 -mb-4 p-3 rounded-b-xl border-t border-blue-100">
              <div className="flex items-center space-x-2 text-blue-900 text-xs font-semibold">
                <Users className="w-4 h-4 text-blue-600" />
                <span>Estimated Reach</span>
              </div>
              <span className="text-blue-700 font-bold text-sm">
                ~{data.recipient_count.toLocaleString()} recipients
              </span>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSending}
            className="flex items-center space-x-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Sending Broadcast...' : (data.is_scheduled ? 'Confirm & Schedule' : 'Confirm & Send Broadcast')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
