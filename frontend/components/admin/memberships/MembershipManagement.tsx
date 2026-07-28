"use client";

import React, { useState, useEffect } from 'react';
import { 
  Crown, Plus, Users, IndianRupee, TrendingUp, Star, Check, 
  MoreVertical, Edit, Trash2, UserCheck, ShieldCheck, 
  Clock, Calendar, Filter, Search, ChevronRight, X, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { App } from 'antd';
import axios from 'axios';
import { API_URL } from '@/config/api';
import ConfirmationModal from '../common/ConfirmationModal';

interface Membership {
  _id: string;
  name: string;
  description: string;
  price: number;
  duration: 'monthly' | 'quarterly' | 'yearly';
  discountPercentage: number;
  features: string[];
  benefits: string[];
  role: 'user' | 'provider';
  
  userConfig?: {
    priorityBooking: boolean;
    bookingLimit: number;
    freeReschedule: boolean;
    couponLimit: number;
    exclusiveCoupons: boolean;
    refundPriority: boolean;
    refundProcessingDays: number;
    cancellationDiscountPercentage: number;
    cashbackPercentage: number;
    prioritySupport: boolean;
    preferredVerifiedProviders: boolean;
    freeCancellation: boolean;
  };

  providerConfig?: {
    featuredListing: boolean;
    boostVisibility: boolean;
    priorityLeadAccess: boolean;
    unlimitedBookings: boolean;
    monthlyLeadLimit: number;
    analyticsDashboard: boolean;
    dedicatedAccountManager: boolean;
    premiumBadge: boolean;
    priorityDispatch: boolean;
    commissionPercentage: number;
  };

  badgeLabel?: string;
  cardHighlightColor?: string;
  isPopular: boolean;
  status: 'active' | 'inactive';
  subscribersCount?: number;
  createdAt: string;
}

interface Stats {
  totalPlans: number;
  activeMembers: number;
  monthlyRevenue: number;
  premiumUsers: number;
}

const MembershipManagement: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPlans: 0,
    activeMembers: 0,
    monthlyRevenue: 0,
    premiumUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
  const [viewingUsersFor, setViewingUsersFor] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [membershipToDelete, setMembershipToDelete] = useState<Membership | null>(null);
  const [selectedRole, setSelectedRole] = useState<'user' | 'provider'>('user');

  useEffect(() => {
    fetchData();
  }, [selectedRole]);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [membershipsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/memberships?role=${selectedRole}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/memberships/stats?role=${selectedRole}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMemberships(membershipsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching membership data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (membershipId: string) => {
    setLoadingUsers(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/memberships/${membershipId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleDelete = async () => {
    if (!membershipToDelete) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_URL}/memberships/${membershipToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting membership:', error);
    } finally {
      setMembershipToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Crown className="text-white" size={24} />
            </div>
            MEMBERSHIP PLANS
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage subscription plans, pricing, features, and active members.</p>
        </div>
        <button 
          onClick={() => { setEditingMembership(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          Add Membership
        </button>
      </div>

      {/* Role Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            selectedRole === 'user'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
          }`}
          onClick={() => setSelectedRole('user')}
        >
          User
        </button>
        <button
          className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            selectedRole === 'provider'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
          }`}
          onClick={() => setSelectedRole('provider')}
        >
          Provider
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard title="Total Plans" value={stats.totalPlans} icon={<Crown size={20} />} color="blue" />
        <StatCard title="Active Members" value={stats.activeMembers} icon={<Users size={20} />} color="green" />
        <StatCard title="Monthly Revenue" value={`₹${stats.monthlyRevenue}`} icon={<IndianRupee size={20} />} color="purple" />
        <StatCard title="Premium Users" value={stats.premiumUsers} icon={<Star size={20} />} color="amber" />
      </div>

      {/* Memberships Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {memberships.map((membership, index) => (
          <MembershipCard 
            key={membership._id} 
            membership={membership} 
            index={index}
            onEdit={() => { setEditingMembership(membership); setIsModalOpen(true); }}
            onDelete={() => setMembershipToDelete(membership)}
            onViewUsers={() => { setViewingUsersFor(membership._id); fetchUsers(membership._id); }}
          />
        ))}
      </div>

      {/* Modals will be added here */}
      {isModalOpen && (
        <MembershipFormModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          membership={editingMembership}
          onSuccess={() => { setIsModalOpen(false); fetchData(); }}
        />
      )}

      {viewingUsersFor && (
        <UsersListModal 
          isOpen={!!viewingUsersFor} 
          onClose={() => setViewingUsersFor(null)} 
          users={users}
          loading={loadingUsers}
          planName={memberships.find(m => m._id === viewingUsersFor)?.name || ''}
        />
      )}

      <ConfirmationModal
        isOpen={!!membershipToDelete}
        onClose={() => setMembershipToDelete(null)}
        onConfirm={handleDelete}
        title="Account Termination"
        message={`Are you absolutely sure you want to remove ${membershipToDelete?.name}? This operation is irreversible and will scrub all associated data from the registry.`}
        confirmLabel="Terminate Plan"
        cancelLabel="Abort Mission"
        variant="danger"
      />
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: any, icon: any, color: string }) => {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600'
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex items-center gap-5"
    >
      <div className={`p-4 rounded-2xl ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-gray-900 mt-0.5">{value}</p>
      </div>
    </motion.div>
  );
};

const MembershipCard = ({ membership, index, onEdit, onDelete, onViewUsers }: { membership: Membership, index: number, onEdit: () => void, onDelete: () => void, onViewUsers: () => void }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden group hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col relative"
    >
      {membership.isPopular && (
        <div className="absolute top-6 right-6 px-3 py-1 bg-amber-100 text-amber-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-200">
          Popular Plan
        </div>
      )}
      
      <div className="p-8 pb-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 group-hover:rotate-6 transition-transform">
          <Crown size={24} />
        </div>
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{membership.name}</h3>
        <p className="text-xs text-gray-500 font-medium mt-2 leading-relaxed">{membership.description}</p>
      </div>

      <div className="px-8 py-6 bg-gray-50/50 flex items-baseline gap-1">
        <span className="text-3xl font-black text-gray-900">₹{membership.price}</span>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">/ {membership.duration}</span>
      </div>

      <div className="p-8 flex-1">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Core Features</p>
        <div className="space-y-3">
          {membership.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
                <Check size={12} strokeWidth={3} />
              </div>
              <span className="text-xs font-bold text-gray-700">{feature}</span>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-8 mb-4">System Logic Settings</p>
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
          {membership.role === 'user' && membership.userConfig ? (
            <>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Priority Booking</span>
                <span className={membership.userConfig.priorityBooking ? 'text-green-600' : 'text-gray-400'}>{membership.userConfig.priorityBooking ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Refund Speed</span>
                <span className="text-gray-800">{membership.userConfig.refundProcessingDays} Days</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Coupons</span>
                <span className="text-gray-800">{membership.userConfig.couponLimit === 999 ? 'Unlimited' : `${membership.userConfig.couponLimit}/month`}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Booking Limit</span>
                <span className="text-gray-800">{membership.userConfig.bookingLimit === -1 ? 'Unlimited' : membership.userConfig.bookingLimit}</span>
              </div>
            </>
          ) : membership.role === 'provider' && membership.providerConfig ? (
            <>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Featured Listing</span>
                <span className={membership.providerConfig.featuredListing ? 'text-green-600' : 'text-gray-400'}>{membership.providerConfig.featuredListing ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Priority Leads</span>
                <span className={membership.providerConfig.priorityLeadAccess ? 'text-green-600' : 'text-gray-400'}>{membership.providerConfig.priorityLeadAccess ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Analytics Dashboard</span>
                <span className={membership.providerConfig.analyticsDashboard ? 'text-green-600' : 'text-gray-400'}>{membership.providerConfig.analyticsDashboard ? 'YES' : 'NO'}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold">
                <span className="text-gray-500">Commission</span>
                <span className="text-gray-800">{membership.providerConfig.commissionPercentage}%</span>
              </div>
            </>
          ) : (
             <div className="text-[10px] text-gray-400 font-bold italic text-center py-2">Standard Configuration</div>
          )}
        </div>
      </div>

      <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-between bg-white">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Subscribers</span>
          <span className="text-sm font-black text-gray-900">{membership.subscribersCount || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onViewUsers} className="p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="View Active Users">
            <Users size={16} />
          </button>
          <button onClick={onEdit} className="p-2.5 bg-gray-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Edit Plan">
            <Edit size={16} />
          </button>
          <button onClick={onDelete} className="p-2.5 bg-gray-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Delete Plan">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// --- Modals ---

const MembershipFormModal = ({ isOpen, onClose, membership, onSuccess }: any) => {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    duration: 'monthly',
    role: 'user',
    discountPercentage: 0,
    features: [''],
    benefits: [] as string[],
    userConfig: {
      priorityBooking: false,
      bookingLimit: 10,
      freeReschedule: false,
      couponLimit: 2,
      exclusiveCoupons: false,
      refundPriority: false,
      refundProcessingDays: 7,
      cancellationDiscountPercentage: 0,
      cashbackPercentage: 0,
      prioritySupport: false,
      preferredVerifiedProviders: false,
      freeCancellation: false
    },
    providerConfig: {
      featuredListing: false,
      boostVisibility: false,
      priorityLeadAccess: false,
      unlimitedBookings: false,
      monthlyLeadLimit: 50,
      analyticsDashboard: false,
      dedicatedAccountManager: false,
      premiumBadge: false,
      priorityDispatch: false,
      commissionPercentage: 15
    },
    isPopular: false,
    status: 'active'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (membership) {
      setForm({
        ...membership,
        features: membership.features?.length > 0 ? membership.features : [''],
        benefits: membership.benefits || [],
        userConfig: membership.userConfig || form.userConfig,
        providerConfig: membership.providerConfig || form.providerConfig
      });
    }
  }, [membership]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...form,
        features: form.features.filter(f => f.trim() !== ''),
      };
      if (membership) {
        await axios.put(`${API_URL}/memberships/${membership._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/memberships`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const addFeature = () => setForm({ ...form, features: [...form.features, ''] });
  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...form.features];
    newFeatures[index] = value;
    setForm({ ...form, features: newFeatures });
  };
  const removeFeature = (index: number) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== index) });
  };

  const userBenefits = ['Priority booking', 'Exclusive offers', 'Early access', 'Free cancellation', 'Premium Support', 'VIP Support'];
  const providerBenefits = ['Top listing', 'Zero commission', 'Premium badge', 'Priority dispatch', 'Analytics dashboard', 'Dedicated Account Manager'];
  const availableBenefits = form.role === 'provider' ? providerBenefits : userBenefits;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">{membership ? 'Refine Plan' : 'Draft New Plan'}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Configure Membership Parameters</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-8">
          {/* Role Selection */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">00. Membership Type</h3>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${form.role === 'user' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}>
                <input 
                  type="radio" 
                  name="role"
                  value="user"
                  checked={form.role === 'user'} 
                  onChange={() => setForm({ ...form, role: 'user', benefits: [] })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">User</span>
              </label>
              <label className={`flex-1 flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${form.role === 'provider' ? 'border-blue-600 bg-blue-50/50' : 'border-gray-200 hover:border-blue-300'}`}>
                <input 
                  type="radio" 
                  name="role"
                  value="provider"
                  checked={form.role === 'provider'} 
                  onChange={() => setForm({ ...form, role: 'provider', benefits: [] })}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Provider</span>
              </label>
            </div>
          </div>

          {/* Basic Details */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">01. Basic Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Plan Name</label>
                <input 
                  required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                  placeholder="e.g. ELITE CLUB"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                <textarea 
                  required
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all min-h-[80px]"
                  placeholder="Summarize plan value..."
                />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">02. Financial Logic</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Base Price (₹)</label>
                <input 
                  type="number" required
                  value={form.price || ''}
                  onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount (%)</label>
                <input 
                  type="number" 
                  value={form.discountPercentage || ''}
                  onChange={e => setForm({ ...form, discountPercentage: Number(e.target.value) })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Duration</label>
                <select 
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: e.target.value as any })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all appearance-none"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">03. Features Repository</h3>
              <button type="button" onClick={addFeature} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">+ Add Entry</button>
            </div>
            <div className="space-y-3">
              {form.features.map((feature, i) => (
                <div key={i} className="flex gap-2">
                  <input 
                    value={feature}
                    onChange={e => updateFeature(i, e.target.value)}
                    className="flex-1 px-5 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder={`Feature #${i+1}`}
                  />
                  {form.features.length > 1 && (
                    <button type="button" onClick={() => removeFeature(i)} className="p-3 text-red-400 hover:text-red-600 transition-colors">
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* System Logic Config */}
          <div className="space-y-4">
             <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">04. System Logic Configuration</h3>
             <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
               {form.role === 'user' ? (
                 <>
                   <div className="grid grid-cols-2 gap-4">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.userConfig.priorityBooking} onChange={e => setForm({...form, userConfig: {...form.userConfig, priorityBooking: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Priority Booking</span>
                     </label>
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.userConfig.refundPriority} onChange={e => setForm({...form, userConfig: {...form.userConfig, refundPriority: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Refund Priority</span>
                     </label>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Booking Limit (-1 for Unlmt)</label>
                       <input type="number" value={form.userConfig.bookingLimit} onChange={e => setForm({...form, userConfig: {...form.userConfig, bookingLimit: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Coupon Limit (999 for Unlmt)</label>
                       <input type="number" value={form.userConfig.couponLimit} onChange={e => setForm({...form, userConfig: {...form.userConfig, couponLimit: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cashback (%)</label>
                       <input type="number" value={form.userConfig.cashbackPercentage} onChange={e => setForm({...form, userConfig: {...form.userConfig, cashbackPercentage: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Refund Days</label>
                       <input type="number" value={form.userConfig.refundProcessingDays} onChange={e => setForm({...form, userConfig: {...form.userConfig, refundProcessingDays: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                   </div>
                 </>
               ) : (
                 <>
                   <div className="grid grid-cols-2 gap-4">
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.providerConfig.featuredListing} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, featuredListing: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Featured Listing</span>
                     </label>
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.providerConfig.priorityLeadAccess} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, priorityLeadAccess: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Priority Lead Access</span>
                     </label>
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.providerConfig.analyticsDashboard} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, analyticsDashboard: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Analytics Dashboard</span>
                     </label>
                     <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={form.providerConfig.priorityDispatch} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, priorityDispatch: e.target.checked}})} className="w-5 h-5 rounded text-blue-600" />
                        <span className="text-xs font-bold text-gray-700">Priority Dispatch</span>
                     </label>
                   </div>
                   <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monthly Lead Limit</label>
                       <input type="number" value={form.providerConfig.monthlyLeadLimit} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, monthlyLeadLimit: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                     <div>
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commission (%)</label>
                       <input type="number" value={form.providerConfig.commissionPercentage} onChange={e => setForm({...form, providerConfig: {...form.providerConfig, commissionPercentage: Number(e.target.value)}})} className="w-full mt-1 px-4 py-3 bg-white border-gray-200 rounded-xl border text-xs font-bold focus:outline-none focus:border-blue-300" />
                     </div>
                   </div>
                 </>
               )}
             </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-8 py-4 border-t border-gray-100">
             <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={form.isPopular} 
                  onChange={e => setForm({ ...form, isPopular: e.target.checked })}
                  className="w-5 h-5 rounded-lg border-2 border-gray-200 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-blue-600 transition-colors">Popular Plan</span>
             </label>
             <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={form.status === 'active'} 
                  onChange={e => setForm({ ...form, status: e.target.checked ? 'active' : 'inactive' })}
                  className="w-5 h-5 rounded-lg border-2 border-gray-200 text-green-600 focus:ring-green-500 transition-all cursor-pointer"
                />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-green-600 transition-colors">Active Status</span>
             </label>
          </div>
        </form>

        <div className="p-8 border-t border-gray-100 bg-gray-50 flex gap-4 sticky bottom-0">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-4 bg-white text-gray-500 rounded-2xl font-black text-[11px] uppercase tracking-widest border border-gray-200 hover:bg-gray-100 transition-all">Cancel</button>
          <button 
            type="submit" 
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[2] px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : (membership ? 'Commit Changes' : 'Launch Membership')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UsersListModal = ({ isOpen, onClose, users, loading, planName }: any) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">{planName} Members</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Active Subscribers Intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            {users.length > 0 && (
              <button 
                onClick={() => {
                  const headers = ['Name', 'Email', 'Plan', 'Purchase Date', 'Expiry Date', 'Status'];
                  const csvData = users.map((u: any) => [
                    u.user_id?.name,
                    u.user_id?.email,
                    u.membership_id?.name,
                    new Date(u.purchase_date).toLocaleDateString(),
                    new Date(u.expiry_date).toLocaleDateString(),
                    u.membership_status
                  ].join(','));
                  const csvContent = [headers.join(','), ...csvData].join('\n');
                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${planName}_Subscribers.csv`;
                  a.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all border border-green-100"
              >
                <Download size={14} />
                Export CSV
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-400" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
               <Users size={48} strokeWidth={1} className="mb-4" />
               <p className="font-black uppercase tracking-widest text-[10px]">No active members found for this plan</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subscriber</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Duration</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Validity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usage</th>
                  <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((member: any) => (
                  <tr key={member._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={member.user_id?.profile_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user_id?.name || 'U')}&background=F3F4F6&color=6B7280&bold=true`} 
                          className="w-10 h-10 rounded-xl border border-gray-100 shadow-sm"
                          alt=""
                        />
                        <div>
                          <p className="text-xs font-black text-gray-900">{member.user_id?.name || 'Unknown User'}</p>
                          <p className="text-[10px] text-gray-400 font-bold">{member.user_id?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-xs font-black text-gray-700 uppercase">{member.membership_id?.name}</span>
                       <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Purchased: {new Date(member.purchase_date).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                        <Clock size={12} className="text-amber-500" />
                        {new Date(member.expiry_date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="space-y-1 w-24">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                             <span>Used</span>
                             <span>{member.services_used}</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                             <div className="h-full bg-blue-500" style={{ width: `${Math.min((member.services_used / 10) * 100, 100)}%` }} />
                          </div>
                       </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                        member.membership_status === 'active' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {member.membership_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default function MembershipManagementWrapper() {
  return (
    <App>
      <MembershipManagement />
    </App>
  );
}
