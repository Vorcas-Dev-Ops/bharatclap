"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { Calendar, Clock, Send, XCircle, Smartphone, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

interface ScheduledCampaign {
  id: string;
  title: string;
  message: string;
  app: string;
  audience: string;
  type: string;
  action_type: string;
  action_value?: string;
  image_url?: string;
  status: string;
  scheduled_at: string;
  created_at: string;
}

export default function ScheduledTab({ onScheduleUpdate }: { onScheduleUpdate?: () => void }) {
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchScheduled();
  }, []);

  const fetchScheduled = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/campaigns/scheduled`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaigns(res.data || []);
    } catch (err: any) {
      console.error('Failed to load scheduled campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNow = async (id: string) => {
    try {
      setActionLoading(id);
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/notifications/campaigns/${id}/send-now`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback({ type: 'success', message: 'Campaign sent immediately!' });
      fetchScheduled();
      if (onScheduleUpdate) onScheduleUpdate();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to send campaign' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled notification?')) return;
    try {
      setActionLoading(id);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/notifications/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback({ type: 'success', message: 'Scheduled campaign cancelled.' });
      fetchScheduled();
      if (onScheduleUpdate) onScheduleUpdate();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to cancel campaign' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading scheduled broadcasts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Scheduled Broadcasts</h3>
          <p className="text-xs text-slate-500">
            Campaigns queued for automated future dispatch ({campaigns.length})
          </p>
        </div>
        <button
          onClick={fetchScheduled}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No Scheduled Notifications</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            When you compose a notification and select &quot;Schedule for Later&quot;, it will appear here for review and management.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 capitalize">
                      {c.app} App
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {c.type}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(c.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <h4 className="font-bold text-slate-900 text-sm mb-1">{c.title}</h4>
                <p className="text-xs text-slate-600 line-clamp-2 mb-3">{c.message}</p>

                <div className="text-[11px] text-slate-500 space-y-1 pt-2 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span>Scheduled Date:</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(c.scheduled_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audience Filter:</span>
                    <span className="capitalize font-medium text-slate-700">{c.audience}</span>
                  </div>
                  {c.action_type !== 'none' && (
                    <div className="flex justify-between">
                      <span>Action on Tap:</span>
                      <span className="font-medium text-indigo-600 truncate max-w-[180px]">
                        {c.action_type.replace(/open_/g, '')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 mt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleCancel(c.id)}
                  disabled={actionLoading === c.id}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSendNow(c.id)}
                  disabled={actionLoading === c.id}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{actionLoading === c.id ? 'Sending...' : 'Send Now'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
