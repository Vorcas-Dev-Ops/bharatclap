"use client";

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { message, Button, Modal, Spin } from 'antd';
import { Laptop, Smartphone, Monitor, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface Session {
  _id: string;
  device_info: string;
  ip_address: string;
  createdAt: string;
  expires_at: string;
  is_current: boolean;
}

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/users/sessions`);
      setSessions(res.data || []);
    } catch (error) {
      console.error('Failed to fetch active sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAll = () => {
    Modal.confirm({
      title: 'Sign out of all other devices?',
      content: 'You will be signed out of every device except this one. Are you sure?',
      okText: 'Yes, Sign Out All',
      cancelText: 'Cancel',
      okButtonProps: { danger: true, loading: logoutAllLoading },
      onOk: async () => {
        try {
          setLogoutAllLoading(true);
          await axios.delete(`${API_URL}/users/sessions`);
          message.success('Successfully signed out of all devices.');
          fetchSessions();
        } catch (error) {
          message.error('Failed to sign out of devices');
        } finally {
          setLogoutAllLoading(false);
        }
      }
    });
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      await axios.delete(`${API_URL}/users/sessions/${sessionId}`);
      message.success('Device signed out successfully');
      setSessions(prev => prev.filter(s => s._id !== sessionId));
    } catch (error) {
      message.error('Failed to sign out device');
    } finally {
      setRevokingId(null);
    }
  };

  const getDeviceIcon = (userAgent: string) => {
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <Smartphone size={24} className="text-slate-600" />;
    }
    if (ua.includes('macintosh') || ua.includes('windows') || ua.includes('linux')) {
      return <Laptop size={24} className="text-slate-600" />;
    }
    return <Monitor size={24} className="text-slate-600" />;
  };

  const getDeviceName = (userAgent: string) => {
    if (!userAgent || userAgent === 'Unknown Device') return 'Unknown Device';
    
    // Simplistic parsing for display
    if (userAgent.includes('Edg/')) return 'Edge Browser';
    if (userAgent.includes('Chrome/')) return 'Chrome Browser';
    if (userAgent.includes('Firefox/')) return 'Firefox Browser';
    if (userAgent.includes('Safari/')) return 'Safari Browser';
    if (userAgent.includes('PostmanRuntime/')) return 'Postman App';
    
    return userAgent.substring(0, 30) + (userAgent.length > 30 ? '...' : '');
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert size={20} className="text-blue-600" /> Active Sessions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            These are the devices currently signed into your account.
          </p>
        </div>
        
        {sessions.length > 1 && (
          <Button 
            danger 
            type="primary" 
            ghost 
            className="font-medium rounded-lg"
            onClick={handleLogoutAll}
            loading={logoutAllLoading}
          >
            Sign Out All Devices
          </Button>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        <AnimatePresence>
          {sessions.map((session) => (
            <motion.div 
              key={session._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                  {getDeviceIcon(session.device_info)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800">
                      {getDeviceName(session.device_info)}
                    </h3>
                    {session.is_current && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase">
                        <CheckCircle2 size={12} /> This Device
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{session.ip_address}</span>
                    <span className="text-slate-300">•</span>
                    <span>Signed in {formatDistanceToNow(new Date(session.createdAt))} ago</span>
                  </div>
                </div>
              </div>

              {!session.is_current && (
                <Button 
                  type="text" 
                  danger 
                  icon={<LogOut size={16} />}
                  onClick={() => handleRevokeSession(session._id)}
                  loading={revokingId === session._id}
                  className="font-medium flex items-center self-end sm:self-auto"
                >
                  Sign Out
                </Button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {sessions.length === 0 && !loading && (
          <div className="p-8 text-center text-slate-500">
            No active sessions found.
          </div>
        )}
      </div>
    </div>
  );
}
