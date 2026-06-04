"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CalendarCheck, 
  List, 
  Layers, 
  MapPin, 
  Image as ImageIcon, 
  BarChart2,
  Menu,
  X,
  Bell,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const sidebarLinks = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Providers', href: '/admin/providers', icon: Briefcase },
  { name: 'Bookings', href: '/admin/bookings', icon: CalendarCheck },
  { name: 'Categories', href: '/admin/categories', icon: List },
  { name: 'Sub-Services', href: '/admin/sub-services', icon: Layers },
  { name: 'Locations', href: '/admin/locations', icon: MapPin },
  { name: 'Banners', href: '/admin/banners', icon: ImageIcon },
  { name: 'Reports', href: '/admin/reports', icon: BarChart2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* Sidebar - Desktop */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] border-r border-[#1E293B] shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-[#1E293B]">
          <Link href="/admin/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">ServiceAdmin</span>
          </Link>
          <button 
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto h-[calc(100vh-4rem)]">
          <div className="space-y-1.5">
            {sidebarLinks.map((link) => {
              const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/admin/dashboard');
              const Icon = link.icon;
              return (
                <Link 
                  key={link.name} 
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                    isActive 
                      ? 'bg-blue-600/10 text-blue-400 font-medium' 
                      : 'text-gray-400 hover:bg-[#1E293B] hover:text-white'
                  }`}
                >
                  <Icon 
                    size={20} 
                    className={`${isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-white'}`} 
                  />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[#0F172A]/80 backdrop-blur-sm lg:hidden lg:z-auto"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gray-50">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              className="text-gray-600 hover:text-gray-900 focus:outline-none lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            
            <div className="hidden sm:flex items-center bg-gray-100/80 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-blue-100 transition-all border border-gray-200">
              <Search size={18} className="text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm ml-2 w-64 text-gray-700"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button className="relative text-gray-500 hover:text-blue-600 transition-colors">
              <Bell size={22} strokeWidth={1.5} />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block"></div>
            
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-800 leading-none group-hover:text-blue-600 transition-colors">Admin User</p>
                <p className="text-[11px] text-gray-500 mt-1 uppercase font-medium tracking-wider">Super Admin</p>
              </div>
              <img 
                src="https://ui-avatars.com/api/?name=Admin+User&background=2563eb&color=fff&bold=true" 
                alt="Profile" 
                className="w-9 h-9 rounded-full ring-2 ring-gray-100 shadow-sm"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
