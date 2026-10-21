"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import {
  Send,
  CheckCircle2,
  Users,
  Eye,
  Smartphone,
  RefreshCw,
  Search,
  Filter,
  BarChart2,
  ArrowUpRight
} from 'lucide-react';

interface CampaignHistoryItem {
  id: string;
  title: string;
  message: string;
  app: string;
  audience: string;
  type: string;
  action_type: string;
  status: string;
  targeted_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  created_at: string;
  sent_at?: string;
}

export default function SentHistoryTab() {
  const [history, setHistory] = useState<CampaignHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [appFilter, setAppFilter] = useState<'all' | 'customer' | 'partner'>('all');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/notifications/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter campaigns that are sent or completed
      const sentCampaigns = (res.data || []).filter(
        (c: any) => c.status === 'sent' || c.status === 'completed'
      );
      setHistory(sentCampaigns);
    } catch (err: any) {
      console.error('Failed to load sent campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesApp = appFilter === 'all' || item.app === appFilter || item.app === 'both';
    return matchesSearch && matchesApp;
  });

  // Calculate metrics
  const totalSent = history.reduce((sum, item) => sum + (item.sent_count || item.targeted_count || 0), 0);
  const totalDelivered = history.reduce((sum, item) => sum + (item.delivered_count || item.targeted_count || 0), 0);
  const totalOpened = history.reduce((sum, item) => sum + (item.opened_count || 0), 0);
  const avgOpenRate = totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Loading broadcast history & metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Level Metric KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Broadcasts</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{history.length}</div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center mt-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              All dispatched
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Send className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Messages Sent</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalSent.toLocaleString()}</div>
            <span className="text-[11px] text-slate-500 mt-1">Across all campaigns</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Delivered</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalDelivered.toLocaleString()}</div>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1">
              {totalSent > 0 ? `${((totalDelivered / totalSent) * 100).toFixed(1)}% delivery` : '100%'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">App Opens / Clicks</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalOpened.toLocaleString()}</div>
            <span className="text-[11px] text-purple-600 font-semibold mt-1">~{avgOpenRate}% avg open rate</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Eye className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns by title or text..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-slate-500 font-medium flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" />
            App:
          </span>
          {(['all', 'customer', 'partner'] as const).map((app) => (
            <button
              key={app}
              onClick={() => setAppFilter(app)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                appFilter === app
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {app === 'all' ? 'All Apps' : `${app} App`}
            </button>
          ))}
          <button
            onClick={fetchHistory}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition ml-1"
            title="Refresh history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* History Table / Cards */}
      {filteredHistory.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-dashed border-slate-300 text-center">
          <Send className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-700">No Sent Notifications Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            {searchQuery || appFilter !== 'all'
              ? 'No broadcast records match your active search or filter criteria.'
              : 'You haven\'t dispatched any broadcast campaigns yet. Compose a notification to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Notification Details</th>
                  <th className="py-3.5 px-4">Target App</th>
                  <th className="py-3.5 px-4">Audience</th>
                  <th className="py-3.5 px-4 text-right">Targeted</th>
                  <th className="py-3.5 px-4 text-right">Delivered</th>
                  <th className="py-3.5 px-4 text-right">Opened</th>
                  <th className="py-3.5 px-4 text-right">Date Sent</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item) => {
                  const delivered = item.delivered_count || item.targeted_count || 0;
                  const opened = item.opened_count || 0;
                  const rate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : '0';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-slate-900 line-clamp-1">{item.title}</div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.message}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {item.type}
                          </span>
                          {item.action_type !== 'none' && (
                            <span className="text-[10px] text-slate-400">
                              Action: {item.action_type.replace(/open_/g, '')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-700 capitalize bg-slate-100 px-2 py-0.5 rounded">
                          {item.app}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap capitalize text-slate-600">
                        {item.audience}
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 whitespace-nowrap">
                        {(item.targeted_count || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {delivered.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-bold text-slate-900">{opened.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 ml-1">({rate}%)</span>
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap">
                        <div>
                          {new Date(item.sent_at || item.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-[10px]">
                          {new Date(item.sent_at || item.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Sent</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
