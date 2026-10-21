"use client";

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { Smartphone, Send, CheckCircle2, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface TestTarget {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
}

interface TestNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notificationData: {
    title: string;
    message: string;
    app: string;
    type: string;
    action_type: string;
    action_value?: string;
    image_url?: string;
    sound_enabled?: boolean;
    sound?: string;
  };
}

export default function TestNotificationModal({
  isOpen,
  onClose,
  notificationData,
}: TestNotificationModalProps) {
  const [testTargets, setTestTargets] = useState<TestTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<TestTarget | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTargets();
      setResultMessage(null);
    }
  }, [isOpen, notificationData.app]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const targetRole = notificationData.app === 'both' ? 'both' : notificationData.app;
      const res = await axios.get(`${API_URL}/notifications/test-targets?role=${targetRole}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTestTargets(res.data || []);
      if (res.data?.length > 0) {
        setSelectedTarget(res.data[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch test targets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setSending(true);
      setResultMessage(null);
      const token = localStorage.getItem('token');

      const payload = {
        title: notificationData.title,
        message: notificationData.message,
        app: notificationData.app,
        type: notificationData.type,
        action_type: notificationData.action_type,
        action_value: notificationData.action_value,
        image_url: notificationData.image_url,
        sound_enabled: notificationData.sound_enabled !== false,
        sound: notificationData.sound || 'default',
        target_id: selectedTarget?.id,
        target_role: selectedTarget?.type.toLowerCase() || 'customer',
        target_phone: customPhone || selectedTarget?.phone,
      };

      const res = await axios.post(`${API_URL}/notifications/campaigns/test`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setResultMessage({
        type: 'success',
        text: res.data?.message || 'Test notification dispatched successfully! Check device screen.'
      });
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to dispatch test notification.'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send Test Notification" size="md">
      <div className="space-y-5">
        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
          <Smartphone size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Safe Verification Mode</span>
            Dispatch a private test notification to your test device or account before broadcasting to your general audience.
          </div>
        </div>

        {/* Selected Test Account */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Select Test Device / Account
          </label>
          {loading ? (
            <div className="py-6 flex items-center justify-center text-xs text-gray-400 gap-2">
              <RefreshCw size={14} className="animate-spin text-blue-600" />
              Loading verified test devices...
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {testTargets.map((target) => {
                const isSelected = selectedTarget?.id === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => {
                      setSelectedTarget(target);
                      setCustomPhone('');
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        target.type === 'Partner' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {target.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                          {target.name}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            target.type === 'Partner' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}>
                            {target.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {target.phone || target.email || target.id}
                        </div>
                      </div>
                    </div>
                    {isSelected && <UserCheck size={16} className="text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Payload Preview */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1 text-xs">
          <span className="font-bold text-gray-700 block">Dispatch Payload Preview:</span>
          <div className="text-gray-900 font-bold truncate">Title: {notificationData.title || '(Empty title)'}</div>
          <div className="text-gray-600 text-[11px] truncate">Body: {notificationData.message || '(Empty body)'}</div>
          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-3 pt-1">
            <span>Action: {notificationData.action_type}</span>
            {notificationData.action_value && <span>Target: {notificationData.action_value}</span>}
          </div>
        </div>

        {/* Feedback message */}
        {resultMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            resultMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-red-50 border border-red-200 text-red-900'
          }`}>
            {resultMessage.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-600 shrink-0" />
            )}
            <span className="font-medium">{resultMessage.text}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sending || (!selectedTarget && !customPhone)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Send size={14} />
                Send Test Now
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
