"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import {
  FileText,
  Smartphone,
  ArrowRight,
  Tag,
  RefreshCw,
  Plus,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface NotificationTemplate {
  id: string;
  name: string;
  category: string;
  app: string;
  title: string;
  message: string;
  action_type: string;
  action_value?: string;
  image_url?: string;
  is_system?: boolean;
}

interface TemplatesTabProps {
  onUseTemplate: (template: NotificationTemplate) => void;
}

export default function TemplatesTab({ onUseTemplate }: TemplatesTabProps) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter] = useState<'all' | 'customer' | 'partner'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data || []);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesApp = appFilter === 'all' || t.app === appFilter || t.app === 'both';
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.message.toLowerCase().includes(search.toLowerCase());
    return matchesApp && matchesSearch;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading notification templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg">Notification Templates</h3>
          <p className="text-xs text-slate-500">
            Quick-start reusable messages for common customer & partner events
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {(['all', 'customer', 'partner'] as const).map((app) => (
            <button
              key={app}
              onClick={() => setAppFilter(app)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                appFilter === app
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {app === 'all' ? 'All Templates' : `${app} App`}
            </button>
          ))}
          <button
            onClick={fetchTemplates}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition ml-1"
            title="Refresh templates"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((t) => (
          <div
            key={t.id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    t.app === 'customer'
                      ? 'bg-blue-50 text-blue-700 border border-blue-100'
                      : t.app === 'partner'
                      ? 'bg-amber-50 text-amber-700 border border-amber-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}
                >
                  {t.app} App
                </span>

                <span className="text-[10px] font-medium text-slate-400 uppercase">
                  {t.category}
                </span>
              </div>

              <h4 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition">
                {t.name}
              </h4>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2 space-y-1">
                <p className="text-xs font-semibold text-slate-800">{t.title}</p>
                <p className="text-[11px] text-slate-500 line-clamp-2">{t.message}</p>
              </div>

              {t.action_type !== 'none' && (
                <div className="mt-3 flex items-center text-[11px] text-slate-500">
                  <Tag className="w-3 h-3 mr-1 text-slate-400" />
                  <span>Action: </span>
                  <span className="ml-1 font-medium text-slate-700 capitalize">
                    {t.action_type.replace(/open_/g, '').replace(/_/g, ' ')}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {t.is_system ? 'System Preset' : 'Custom'}
              </span>
              <button
                type="button"
                onClick={() => onUseTemplate(t)}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              >
                <span>Use Template</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
