"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import {
  FileText,
  Clock,
  Edit3,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface DraftCampaign {
  id: string;
  title: string;
  message: string;
  app: string;
  audience: string;
  type: string;
  action_type: string;
  action_value?: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

interface DraftsTabProps {
  onResumeDraft: (draft: DraftCampaign) => void;
}

export default function DraftsTab({ onResumeDraft }: DraftsTabProps) {
  const [drafts, setDrafts] = useState<DraftCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const draftItems = (res.data || []).filter((c: any) => c.status === 'draft');
      setDrafts(draftItems);
    } catch (err: any) {
      console.error('Failed to load drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      setActionLoading(id);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/notifications/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFeedback({ type: 'success', message: 'Draft deleted.' });
      fetchDrafts();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to delete draft' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading saved drafts...</p>
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
          <h3 className="font-bold text-slate-900 text-lg">Saved Drafts</h3>
          <p className="text-xs text-slate-500">
            Unsent campaigns saved for future completion and dispatch ({drafts.length})
          </p>
        </div>
        <button
          onClick={fetchDrafts}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No Drafts Saved</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            When composing a notification, click &quot;Save Draft&quot; to store your progress and finish later.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                    {d.app} App
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm mb-1">{d.title || 'Untitled Draft'}</h4>
                <p className="text-xs text-slate-600 line-clamp-3 mb-3">{d.message || 'No message content'}</p>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={actionLoading === d.id}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                  title="Delete Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onResumeDraft(d)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Resume Editing</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
