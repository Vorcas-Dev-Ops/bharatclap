"use client";

import React, { useState } from 'react';
import { Search, Filter, Eye, Ban, Trash2, MoreVertical, Plus, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DUMMY_USERS = [
  { id: 1, name: 'John Doe', email: 'john@example.com', phone: '+91 9876543210', status: 'OPERATIONAL' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '+91 9876543211', status: 'OPERATIONAL' },
  { id: 3, name: 'Robert Johnson', email: 'robert@example.com', phone: '+91 9876543212', status: 'SUSPENDED' },
  { id: 4, name: 'Emily Davis', email: 'emily@example.com', phone: '+91 9876543213', status: 'ONBOARDING' },
];

export default function UsersManagement() {
   const [searchTerm, setSearchTerm] = useState('');
   const [filterStatus, setFilterStatus] = useState('ALL ROLES'); 
   const [isFilterOpen, setIsFilterOpen] = useState(false);
   const filterRef = React.useRef<HTMLDivElement>(null);

   React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
            setIsFilterOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const roles = ['ALL ROLES', 'OPERATIONAL', 'SUSPENDED', 'ONBOARDING'];

  const filteredUsers = DUMMY_USERS.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
     const matchesFilter = filterStatus === 'ALL ROLES' || user.status.toUpperCase() === filterStatus.toUpperCase();
     return matchesSearch && matchesFilter;
   });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage platform users, roles, and access limits.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1">
          <Plus size={16} />
          Add User
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Top Bar for Table */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
           <div className="relative" ref={filterRef}>
             <div 
               onClick={() => setIsFilterOpen(!isFilterOpen)}
               className={`flex items-center gap-2 px-4 py-2 bg-white border rounded-xl shadow-sm cursor-pointer transition-all hover:border-blue-400 group ${isFilterOpen ? 'border-blue-500 ring-4 ring-blue-500/5' : 'border-gray-200'}`}
             >
               <Filter size={14} className={isFilterOpen ? 'text-blue-500' : 'text-gray-400'} />
               <span className="text-[11px] font-black text-gray-700 uppercase tracking-widest">{filterStatus}</span>
               <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${isFilterOpen ? 'rotate-180 text-blue-500' : ''}`} />
             </div>

             <AnimatePresence>
               {isFilterOpen && (
                 <motion.div 
                   initial={{ opacity: 0, y: 8, scale: 0.95 }}
                   animate={{ opacity: 1, y: 4, scale: 1 }}
                   exit={{ opacity: 0, y: 8, scale: 0.95 }}
                   className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 overflow-hidden"
                 >
                   <div className="p-1">
                     {roles.map((role) => (
                       <div 
                         key={role}
                         onClick={() => {
                           setFilterStatus(role);
                           setIsFilterOpen(false);
                         }}
                         className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest cursor-pointer transition-colors rounded-lg ${filterStatus === role ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'}`}
                       >
                         {role}
                       </div>
                     ))}
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 font-semibold rounded-tl-xl w-1/4">Name</th>
                <th className="px-6 py-4 font-semibold w-1/4">Email</th>
                <th className="px-6 py-4 font-semibold">Phone</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-center rounded-tr-xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">{user.phone}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.status === 'Active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                      }`}>
                        {user.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>}
                        {user.status === 'Blocked' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></span>}
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center items-center gap-3">
                        <button className="text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 p-1.5 rounded-md tooltip-wrapper" title="View">
                          <Eye size={16} />
                        </button>
                        <button className="text-yellow-600 hover:text-yellow-800 transition-colors bg-yellow-50 p-1.5 rounded-md tooltip-wrapper" title="Block">
                          <Ban size={16} />
                        </button>
                        <button className="text-red-600 hover:text-red-800 transition-colors bg-red-50 p-1.5 rounded-md tooltip-wrapper" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination placeholder */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing <span className="font-semibold text-gray-700">1</span> to <span className="font-semibold text-gray-700">{filteredUsers.length}</span> of <span className="font-semibold text-gray-700">{DUMMY_USERS.length}</span> entries</p>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-white border border-gray-200 text-gray-500 rounded text-xs hover:bg-gray-50 transition-colors disabled:opacity-50">Prev</button>
            <button className="px-3 py-1 bg-blue-600 border border-blue-600 text-white rounded text-xs">1</button>
            <button className="px-3 py-1 bg-white border border-gray-200 text-gray-500 rounded text-xs hover:bg-gray-50 transition-colors disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
