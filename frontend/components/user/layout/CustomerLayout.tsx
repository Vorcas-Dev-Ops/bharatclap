"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CustomerSidebar from './CustomerSidebar';
import CustomerHeader from './CustomerHeader';
import Cookies from 'js-cookie';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
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
      const userData = user.user || user;

      if (userData.role !== 'customer') {
        const role = userData.role?.toLowerCase();
        if (role === 'admin' || role === 'super_admin') {
          window.location.href = '/admin/dashboard';
          return;
        } else if (role === 'provider') {
          window.location.href = '/provider/dashboard';
          return;
        }
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
      <div className="h-screen w-full flex items-center justify-center bg-[#FCF8FF]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1D2B83]"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#FCF8FF] flex font-sans overflow-hidden">
      <CustomerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <CustomerHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
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
