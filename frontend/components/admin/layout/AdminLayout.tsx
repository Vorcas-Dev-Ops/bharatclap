"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '@/context/AuthContext';

export default function AdminLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, status, isLoading, isReconnecting, isAuthenticated } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isReconnecting) {
      const role = user?.role?.toLowerCase();
      const isAdmin = role === 'admin' || role === 'super_admin';
      if (!isAuthenticated || !isAdmin) {
        window.location.replace('/login');
      }
    }
  }, [isLoading, isReconnecting, isAuthenticated, user]);

  if (isReconnecting && !user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4 p-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        <h2 className="text-lg font-bold text-slate-800">Backend Unavailable</h2>
        <p className="text-sm text-slate-500 max-w-sm">Reconnecting to server... Please wait while we restore your session.</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition"
          >
            Refresh Page
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition"
          >
            Return to Home Page
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !isAuthenticated || (user?.role !== 'admin' && user?.role !== 'super_admin')) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] flex font-sans overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#0F172A]/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-2 pb-4 custom-scrollbar scroll-smooth">
          <div className="w-full transition-opacity duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
