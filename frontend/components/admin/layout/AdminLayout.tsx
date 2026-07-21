"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import Cookies from 'js-cookie';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      
      if (!token || !userStr) {
        window.location.href = '/login';
        return;
      }

      const user = JSON.parse(userStr);
      // If the login response structure was different, handle both cases
      const userData = user.user || user; 
      
      const role = userData.role?.toLowerCase();
      if (role !== 'admin' && role !== 'super_admin') {
        window.location.href = '/'; // Redirect non-admins to home
        return;
      }
      // Sync cookies if missing to keep proxy and client auth aligned
      if (!Cookies.get('userRole') && userData.role) {
        Cookies.set('userRole', userData.role, { expires: 7 });
      }
      if (!Cookies.get('token') && token) {
        Cookies.set('token', token, { expires: 7 });
      }

      setAuthorized(true);
    } catch (err) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (e) {}
      Cookies.remove('token');
      Cookies.remove('userRole');
      window.location.href = '/login';
    }
  }, []);

  if (!authorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F8FAFC] flex font-sans overflow-hidden">
      {/* Sidebar - Remains fixed by default or taking its column */}
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
        {/* Header - Fixed at top via sticky top-0 in its own file or by being first in flex-col */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar scroll-smooth">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
