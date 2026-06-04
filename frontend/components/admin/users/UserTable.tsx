"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Download, RefreshCcw, UserPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import Table from '../common/Table';
import UserRow from './UserRow';
import { User } from '../types';
import UserDetailsModal from './UserDetailsModal';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import Button from '../common/Button';
import { motion, AnimatePresence } from 'framer-motion';

import axios from 'axios';
import ConfirmationModal from '../common/ConfirmationModal';
import { API_URL } from '@/config/api';

const UserTable: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/users`);
      console.log('API Response:', response.data);
      // Filter for customers only and map backend fields to frontend types
      const mappedUsers = response.data
        .filter((u: any) => {
          const isCustomer = u.role && u.role.toString().toLowerCase().trim() === 'customer';
          return isCustomer;
        })
        .map((u: any) => ({
          id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          status: u.status === 'active' ? 'Active' : 'Blocked',
          joinedDate: new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          avatar: u.profile_image
        }));
      console.log('Filtered Users Data:');
      console.table(mappedUsers);
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'All' || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Calculate slices
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentUsers = filtered.slice(indexOfFirstRow, indexOfLastRow);

  // Reset to page 1 on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleAddUser = async (newUserData: any) => {
    try {
      await axios.post(`${API_URL}/users/register`, newUserData);
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  };

  const handleUpdateUser = async (id: string, updatedData: any) => {
    try {
      await axios.put(`${API_URL}/users/${id}`, updatedData);
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`${API_URL}/users/${userToDelete.id}`);
      await fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Joined Date'];

    const escapeCsv = (str: string | boolean | undefined) =>
      `"${String(str ?? '').replace(/"/g, '""')}"`;

    // Prefix with = so Excel treats it as a string (prevents phone/date mangling)
    const formatExcelStr = (val: string) =>
      `="${String(val ?? '').replace(/"/g, '""')}"`;

    const csvRows = filtered.map(user =>
      [
        escapeCsv(user.name),
        escapeCsv(user.email),
        formatExcelStr(user.phone ?? ''),
        escapeCsv(user.status),
        escapeCsv(user.joinedDate),
      ].join(',')
    );

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `registered_users_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Registered <span className="text-blue-600">Users</span></h1>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleExportCSV} variant="outline" size="sm" icon={Download} className="shadow-sm border-gray-100 bg-white text-[11px]">Export Users</Button>
          <Button
            onClick={() => setIsAddModalOpen(true)}
            variant="primary"
            size="sm"
            icon={UserPlus}
            className="shadow-lg shadow-blue-600/30 text-[11px]"
          >
            Add New Member
          </Button>
        </div>
      </div>

      {/* Control Bar - Compact Version */}
      <div className="bg-white/40 backdrop-blur-xl p-3 px-5 rounded-2xl border border-white/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full max-w-sm group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/50 border border-gray-100 focus:border-blue-200 focus:bg-white focus:ring-4 focus:ring-blue-100/50 rounded-xl text-[11px] font-bold text-gray-800 transition-all duration-300 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white/50 px-3 py-2 rounded-xl border border-gray-100 hover:border-blue-100 transition-all cursor-pointer">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest text-gray-600 focus:outline-none cursor-pointer appearance-none pr-4"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <button className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-transparent hover:border-blue-100" onClick={fetchUsers}>
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* Main Table Layer - High Density */}
      <div className="bg-white/40 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden relative group min-h-[460px] flex flex-col">
        <div className="flex-1">
          <Table
            headers={['Name', 'Email', 'Phone', 'Joined', 'Status', 'Actions']}
            className="relative z-10"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {loading ? (
                <tr key="loading">
                  <td colSpan={6} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCcw size={40} className="text-blue-500 animate-spin opacity-50" />
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] animate-pulse">Synchronizing Registry...</p>
                    </div>
                  </td>
                </tr>
              ) : currentUsers.length > 0 ? (
                currentUsers.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    onView={u => setSelectedUser(u)}
                    onEdit={u => setUserToEdit(u)}
                    onDelete={u => setUserToDelete(u)}
                  />
                ))
              ) : (
                <tr key="none">
                  <td colSpan={6} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center gap-6 opacity-40 grayscale group-hover:grayscale-0 transition-all duration-700">
                      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                        <Search size={48} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">
                          {users.length === 0 ? "No Registered User Found" : "No match found"}
                        </p>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">
                          {users.length === 0 ? "The neural network is currently empty" : "Adjust your search parameters"}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </Table>
        </div>

        {/* Professional Pagination Footer */}
        <div className="p-5 border-t border-white/20 flex flex-col items-center gap-6 bg-white/10">
          <div className="flex flex-col items-center gap-4 w-full">

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[32px] h-8 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${currentPage === page
                      ? "bg-blue-600 text-white border-blue-600 shadow-blue-600/20"
                      : "bg-white text-gray-500 border-gray-100 hover:border-blue-200 hover:bg-blue-50"
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-2 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight size={16} />
              </button>
            </div>

          </div>
        </div>
      </div>

      <UserDetailsModal
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
      />

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddUser}
      />

      <EditUserModal
        isOpen={!!userToEdit}
        user={userToEdit}
        onClose={() => setUserToEdit(null)}
        onUpdate={handleUpdateUser}
      />

      <ConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleDeleteUser}
        title="Account Termination"
        message={`Are you absolutely sure you want to remove ${userToDelete?.name}? This operation is irreversible and will scrub all associated data from the registry.`}
        confirmLabel="Terminate Account"
        cancelLabel="Abort Mission"
        variant="danger"
      />
    </div>
  );
};

export default UserTable;
