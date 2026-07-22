"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import CustomerSidebar from './CustomerSidebar';
import CustomerHeader from './CustomerHeader';
import { useAuth } from '@/context/AuthContext';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        window.location.href = '/login';
        return;
      }

      const role = user?.role?.toLowerCase();
      if (role === 'admin' || role === 'super_admin') {
        window.location.href = '/admin/dashboard';
      } else if (role === 'provider') {
        window.location.href = '/provider/dashboard';
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'customer') {
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
