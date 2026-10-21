"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Calendar,
  History,
  FileText,
  Bookmark,
  Bell,
  Sparkles
} from 'lucide-react';
import NotificationComposer from './NotificationComposer';
import ScheduledTab from './ScheduledTab';
import SentHistoryTab from './SentHistoryTab';
import TemplatesTab from './TemplatesTab';
import DraftsTab from './DraftsTab';

type TabType = 'compose' | 'scheduled' | 'sent' | 'drafts' | 'templates';

export default function NotificationsManager() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('compose');
  const [composerInitialData, setComposerInitialData] = useState<any>(null);

  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && ['compose', 'scheduled', 'sent', 'drafts', 'templates'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [searchParams]);

  const handleUseTemplate = (template: any) => {
    setComposerInitialData({
      app: template.app,
      title: template.title,
      message: template.message,
      type: template.category ? template.category.toUpperCase() : 'MARKETING',
      action_type: template.action_type || 'open_home',
      action_value: template.action_value || '',
      image_url: template.image_url || '',
    });
    setActiveTab('compose');
  };

  const handleResumeDraft = (draft: any) => {
    setComposerInitialData({
      app: draft.app,
      audience: draft.audience,
      title: draft.title,
      message: draft.message,
      type: draft.type,
      action_type: draft.action_type,
      action_value: draft.action_value,
      image_url: draft.image_url,
      scheduled_at: draft.scheduled_at,
    });
    setActiveTab('compose');
  };

  const handleComposerSuccess = () => {
    setComposerInitialData(null);
    setActiveTab('sent');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">Notification Center</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Broadcast push notifications & marketing campaigns to BharatClap Customer & Partner apps
            </p>
          </div>
        </div>

        {/* Tab navigation pills */}
        <div className="flex flex-wrap items-center bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {[
            { id: 'compose', label: 'Send Notification', icon: Send },
            { id: 'scheduled', label: 'Scheduled', icon: Calendar },
            { id: 'sent', label: 'Sent History', icon: History },
            { id: 'drafts', label: 'Drafts', icon: FileText },
            { id: 'templates', label: 'Templates', icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'compose' && activeTab !== 'compose') {
                    // keep current composer data if any
                  }
                  setActiveTab(tab.id as TabType);
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                  isActive
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'compose' && (
        <NotificationComposer
          initialData={composerInitialData}
          onSuccess={handleComposerSuccess}
        />
      )}

      {activeTab === 'scheduled' && (
        <ScheduledTab onScheduleUpdate={() => {}} />
      )}

      {activeTab === 'sent' && (
        <SentHistoryTab />
      )}

      {activeTab === 'drafts' && (
        <DraftsTab onResumeDraft={handleResumeDraft} />
      )}

      {activeTab === 'templates' && (
        <TemplatesTab onUseTemplate={handleUseTemplate} />
      )}
    </div>
  );
}
