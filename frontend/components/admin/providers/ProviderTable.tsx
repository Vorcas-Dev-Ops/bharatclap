"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Filter, RefreshCcw, UserPlus, Briefcase, ChevronLeft, ChevronRight, ChevronDown,
  MapPin, Star, ShieldCheck, Eye, Trash2, Ban, UserCheck, UserX, FileWarning,
  Power, Award, FileSearch, RotateCcw, ShieldAlert, CheckCircle2, MoreHorizontal, Gift, Copy, Check
} from 'lucide-react';
import { Provider } from '../types';
import ApprovalModal from './ApprovalModal';
import InviteExpertModal from './InviteExpertModal';
import ProviderDetailsModal from './ProviderDetailsModal';
import ProviderServicesModal from './ProviderServicesModal';
import SubscriptionManagementModal from './SubscriptionManagementModal';
import WalletAdjustmentModal from './WalletAdjustmentModal';
import WalletFreezeModal from './WalletFreezeModal';
import WalletAuditLogModal from './WalletAuditLogModal';
import Table from '../common/Table';
import Button from '../common/Button';
import Badge from '../common/Badge';
import ConfirmationModal from '../common/ConfirmationModal';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { authFetch } from '@/utils/authFetch';
import { useDebounce } from '@/hooks/useDebounce';

const ProviderTable: React.FC = () => {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'rejected' | 'available' | 'busy' | 'offline' | 'All'>('All');

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  const [locationFilter, setLocationFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isServiceFilterOpen, setIsServiceFilterOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  // Catalog State
  const [subservices, setSubservices] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  
  // Portfolio Modal State
  const [selectedProviderServices, setSelectedProviderServices] = useState<Provider | null>(null);

  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const rowsPerPage = 6;

  // Release Provider state
  const [confirmReleaseProvider, setConfirmReleaseProvider] = useState<any | null>(null);

  // Subscription Modal state
  const [subscriptionModalProvider, setSubscriptionModalProvider] = useState<any | null>(null);

  // Wallet Security Modals state
  const [walletAdjustmentProvider, setWalletAdjustmentProvider] = useState<any | null>(null);
  const [walletFreezeProvider, setWalletFreezeProvider] = useState<any | null>(null);
  const [auditLogModalOpen, setAuditLogModalOpen] = useState<boolean>(false);
  const [auditLogProviderId, setAuditLogProviderId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch locations and catalog static options once on mount in parallel
    Promise.all([fetchLocations(), fetchCatalog()]);
  }, []);

  const fetchProviders = useCallback(async (attempt = 1) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(currentPage),
        limit: String(rowsPerPage),
        status: activeTab === 'All' ? '' : activeTab,
        search: debouncedSearchTerm
      }).toString();

      const response = await authFetch(`${API_URL}/providers?${queryParams}`);
      if (!response || !response.ok) {
        if (response?.status === 503 && attempt < 3) {
          setTimeout(() => fetchProviders(attempt + 1), 1000);
          return;
        }
        setLoading(false);
        return;
      }
      const resData = await response.json();
      const providerData = resData?.data || [];
      setProviders(providerData);
      setTotalRows(resData?.total || 0);
      setTotalPages(resData?.pages || Math.ceil((resData?.total || 0) / rowsPerPage) || 1);
      setLoading(false);
    } catch (error: any) {
      console.warn('[ProviderTable] Fetch notice:', error?.message || error);
      setLoading(false);
    }
  }, [currentPage, activeTab, debouncedSearchTerm]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, debouncedSearchTerm]);

  const fetchLocations = async () => {
    try {
      const response = await axios.get(`${API_URL}/locations`);
      if (Array.isArray(response.data)) {
        setLocations(response.data.filter((loc: any) => loc.type === 'area'));
      }
    } catch (error: any) {
      console.warn('Error fetching locations:', error?.message || error);
    }
  };

  const fetchCatalog = async () => {
    try {
      const [subRes, srvRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/sub-services?limit=500`),
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/categories`)
      ]);
      if (Array.isArray(subRes.data)) setSubservices(subRes.data);
      if (Array.isArray(srvRes.data)) setServices(srvRes.data);
      if (Array.isArray(catRes.data)) setCategories(catRes.data);
    } catch (error: any) {
      console.warn('Error fetching catalog data:', error?.message || error);
    }
  };

  const filtered = useMemo(() => {
    return providers.filter(p => {
      const matchStatus = 
        activeTab === 'All' || 
        p.kyc_status === activeTab || 
        (activeTab === 'available' && p.availability_status === 'available' && !p.isBusy) ||
        (activeTab === 'busy' && Boolean(p.isBusy)) ||
        (activeTab === 'offline' && p.availability_status === 'offline');
      const rawTerm = debouncedSearchTerm.trim().toLowerCase();
      const term = rawTerm.replace(/^#/, '');
      const alnumTerm = term.replace(/[^a-z0-9]/g, '');

      const providerIdStr = String((p as any)._id || (p as any).id || '').toLowerCase();
      const userIdStr = String((p.user_id as any)?._id || p.user_id || '').toLowerCase();
      const codeStr = String((p as any).provider_code || '').toLowerCase();
      const fallbackCodeStr = `bc-gen-${providerIdStr.slice(-6)}`;
      const codeAlnum = codeStr.replace(/[^a-z0-9]/g, '');

      const matchSearch = !term || 
        codeStr.includes(term) ||
        fallbackCodeStr.includes(term) ||
        (alnumTerm ? codeAlnum.includes(alnumTerm) : false) ||
        providerIdStr.includes(term) ||
        userIdStr.includes(term) ||
        (p.user_id?.name?.toLowerCase().includes(term) ?? false) ||
        (p.user_id?.email?.toLowerCase().includes(term) ?? false) ||
        (p.user_id?.phone?.includes(term) ?? false) ||
        ((p as any).business_name?.toLowerCase().includes(term) ?? false);

      let matchFilters = true;
      if (locationFilter !== 'All' || serviceFilter !== 'All') {
        if (p.services && p.services.length > 0) {
          matchFilters = p.services.some(s => {
            const matchesLoc = locationFilter === 'All' || (s.location_ids && s.location_ids.some((loc: any) => (typeof loc === 'object' && loc !== null ? String(loc._id) === locationFilter : String(loc) === locationFilter)));
            const matchesSub = serviceFilter === 'All' || (s.subservice_ids && s.subservice_ids.some((sub: any) => (typeof sub === 'object' && sub !== null ? String(sub._id) === serviceFilter : String(sub) === serviceFilter)));
            return matchesLoc && matchesSub;
          });
        } else {
          matchFilters = false;
        }
      }
      return matchStatus && matchSearch && matchFilters;
    });
  }, [providers, activeTab, debouncedSearchTerm, locationFilter, serviceFilter]);

  // Stats
  const totalProviders = providers.length;
  const pendingCount = providers.filter(p => p.kyc_status === 'pending').length;
  const verifiedCount = providers.filter(p => p.kyc_status === 'verified').length;
  const rejectedCount = providers.filter(p => p.kyc_status === 'rejected').length;

  // Server-side pagination returns rowsPerPage items directly
  const currentProviders = filtered;

  // Dynamic Column Logic
  const headers = activeTab === 'pending'
    ? ['#', 'Provider ID', 'Name', 'Service & Area', 'Jobs', 'Success', 'Status', 'Wallet', 'KYC']
    : ['#', 'Provider ID', 'Name', 'Service & Area', 'Jobs', 'Success', 'Status', 'Wallet', 'KYC', 'Actions'];



  const showCompliance = headers.includes('Compliance');
  const showOperations = headers.includes('Operations');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, locationFilter, serviceFilter]);

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handleAddProvider = (newProvider: Provider) => {
    setProviders([newProvider, ...providers]);
  };

  const handleUpdateStatus = async (id: string, newStatus: string, reason?: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/providers/${id}`,
        { status: newStatus, kyc_rejection_reason: reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchProviders();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Provider Delete state
  const [providerToDelete, setProviderToDelete] = useState<any | null>(null);

  const handleDeleteProvider = async () => {
    if (!providerToDelete) return;
    try {
      const id = providerToDelete._id || providerToDelete.id;
      const res = await authFetch(`${API_URL}/providers/${id}`, {
        method: 'DELETE'
      });
      if (res && res.ok) {
        setProviderToDelete(null);
        fetchProviders();
      } else {
        console.warn('[ProviderTable] Failed to delete provider');
      }
    } catch (error) {
      console.error('Error deleting provider:', error);
    }
  };

  const handleReleaseProvider = async (provider: any, force = false) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/providers/${provider._id}/release`, 
        { force },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.success) {
        alert(response.data.message || 'Provider released successfully');
        setConfirmReleaseProvider(null);
        fetchProviders();
      }
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setConfirmReleaseProvider(provider);
      } else {
        alert('Failed to release provider: ' + (error?.response?.data?.message || error.message));
      }
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <ConfirmationModal
        isOpen={!!confirmReleaseProvider}
        onClose={() => setConfirmReleaseProvider(null)}
        onConfirm={() => handleReleaseProvider(confirmReleaseProvider, true)}
        title="Force Release Provider"
        message="Warning: This provider currently has an active booking. Releasing them could cause duplicate assignment. Are you sure you want to force release?"
        variant="danger"
        confirmLabel="Force Release"
      />

      {/* Simplified Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Provider<span className="text-blue-600">s</span></h1>
      </div>

      {/* Control Rail - High Precision Filters */}
      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search experts (Name, ID, Phone)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-100/50 rounded-2xl text-[11px] font-bold text-gray-800 transition-all duration-300 shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <select
                onChange={(e) => setLocationFilter(e.target.value)}
                value={locationFilter}
                className="pl-10 pr-8 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-600 appearance-none focus:outline-none focus:border-blue-200 shadow-sm cursor-pointer w-full"
              >
                <option value="All">All Locations</option>
                {locations.map(loc => (
                  <option key={loc._id} value={loc._id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <button
                onClick={() => setIsServiceFilterOpen(!isServiceFilterOpen)}
                className="flex items-center gap-3 pl-10 pr-10 py-3 bg-white border border-gray-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-600 shadow-sm transition-all hover:border-gray-200 w-full"
              >
                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <span className="truncate">
                  {serviceFilter === 'All' ? 'All Services' : (subservices.find(s => s._id === serviceFilter)?.subservice_name || 'Selected Service')}
                </span>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition-transform ${isServiceFilterOpen ? 'rotate-180' : ''}`} size={12} />
              </button>

              <AnimatePresence>
                {isServiceFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsServiceFilterOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        <div
                          onClick={() => { setServiceFilter('All'); setIsServiceFilterOpen(false); }}
                          className={`px-4 py-3 text-[10px] font-black tracking-widest cursor-pointer hover:bg-blue-50 transition-colors ${serviceFilter === 'All' ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500'}`}
                        >
                          All Services
                        </div>
                        {subservices.map((sub, idx) => {
                          const name = sub.subservice_name || sub.name || `Subservice ${idx + 1}`;
                          return (
                            <div
                              key={sub._id || idx}
                              onClick={() => {
                                setServiceFilter(sub._id);
                                setIsServiceFilterOpen(false);
                              }}
                              className={`px-4 py-3 text-[10px] font-black tracking-widest cursor-pointer hover:bg-blue-50 transition-colors ${serviceFilter === sub._id ? 'text-blue-600 bg-blue-50/50' : 'text-gray-500'}`}
                            >
                              {name}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={() => setIsInviteModalOpen(true)}
              className="shadow-lg bg-blue-600 text-[10px] py-3 rounded-2xl hidden md:flex"
            >
              Invite Expert
            </Button>
          </div>
        </div>

        {/* Workflow Tabs */}
        <div className="flex border-b border-gray-100 items-end gap-1 px-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'All', label: 'All' },
            { id: 'pending', label: 'Pending KYC' },
            { id: 'verified', label: 'Verified' },
            { id: 'rejected', label: 'Rejected' },
            { id: 'available', label: 'Available' },
            { id: 'busy', label: 'Busy' },
            { id: 'offline', label: 'Offline' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 px-4 text-[10px] font-black uppercase tracking-[0.15em] transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Partner Registry Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[460px] flex flex-col">
        <div className="flex-1">
          <Table
            headers={headers}
            compact
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {currentProviders.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="text-center py-16 text-gray-400 font-bold">
                    No experts/providers found matching the current filters.
                  </td>
                </tr>
              ) : (
                currentProviders.map((provider, index) => {
                  const slNo = (currentPage - 1) * rowsPerPage + index + 1;
                  return (
                    <motion.tr
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={provider._id}
                      className="hover:bg-blue-50/20 transition-all group/row border-b border-gray-50 last:border-0 text-[11px]"
                    >
                      {/* Column 0: SL. NO. */}
                      <td className="px-2 py-2 font-black text-gray-400 text-[10px] text-center w-8 whitespace-nowrap">
                        {slNo}
                      </td>
                  {/* Column 1: Dedicated Provider ID */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[9px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg tracking-wider">
                        {provider.provider_code || `BC-GEN-${String(provider._id).slice(-6).toUpperCase()}`}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const code = provider.provider_code || `BC-GEN-${String(provider._id).slice(-6).toUpperCase()}`;
                          navigator.clipboard.writeText(code);
                        }}
                        className="text-gray-400 hover:text-indigo-600 transition-colors p-0.5 rounded hover:bg-indigo-50"
                        title="Copy Provider ID"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </td>

                  {/* Column 2: Name */}
                  <td className="px-2 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="relative shrink-0">
                        <img
                          src={provider.user_id?.profile_image || `https://ui-avatars.com/api/?name=${provider.user_id?.name || 'Expert'}&background=EFF6FF&color=2563EB&bold=true`}
                          alt={provider.user_id?.name || 'Provider'}
                          className="w-7 h-7 rounded-lg object-cover ring-1 ring-transparent group-hover/row:ring-blue-100 transition-all"
                        />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                          provider.isBusy ? 'bg-amber-500' : (provider.availability_status === 'available' ? 'bg-green-500' : 'bg-gray-300')
                        }`} />
                      </div>
                      <span
                        onClick={() => setEditingProvider(provider)}
                        className="font-black text-gray-900 group-hover/row:text-blue-600 transition-colors uppercase tracking-tight cursor-pointer truncate max-w-[120px]"
                      >
                        {provider.user_id?.name || 'Pending Identity'}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const pSvcs = provider.services || [];
                      const allSubIds = pSvcs.flatMap((ps: any) => (ps.subservice_ids || []).map((s: any) => typeof s === 'string' ? s : s?._id));
                      const matchedSubs = allSubIds
                        .map((id: string) => subservices.find((sub: any) => String(sub._id) === String(id)))
                        .filter(Boolean);

                      const firstSubName = matchedSubs[0]?.subservice_name || matchedSubs[0]?.name;
                      const extraSubCount = matchedSubs.length > 1 ? matchedSubs.length - 1 : 0;
                      const serviceText = firstSubName
                        ? `${firstSubName}${extraSubCount > 0 ? ` (+${extraSubCount})` : ''}`
                        : allSubIds.length > 0 ? `${allSubIds.length} Service${allSubIds.length > 1 ? 's' : ''}` : 'No Services';

                      const allLocIds = [...new Set(pSvcs.flatMap((ps: any) => ps.location_ids || []))];
                      const matchedLocs = allLocIds
                        .map((id: any) => locations.find((loc: any) => String(loc._id) === String(id)))
                        .filter(Boolean);

                      const firstLocName = matchedLocs[0]?.name || matchedLocs[0]?.area_name;
                      const extraLocCount = matchedLocs.length > 1 ? matchedLocs.length - 1 : 0;
                      const locationText = firstLocName
                        ? `${firstLocName}${extraLocCount > 0 ? ` (+${extraLocCount})` : ''}`
                        : allLocIds.length > 0 ? `${allLocIds.length} Area${allLocIds.length > 1 ? 's' : ''}` : 'All Areas';

                      return (
                        <button
                          onClick={() => setSelectedProviderServices(provider)}
                          className="group flex flex-col items-start p-1 rounded-lg hover:bg-indigo-50/80 border border-transparent hover:border-indigo-100 transition-all text-left cursor-pointer max-w-[130px]"
                          title="Click to view portfolio & services"
                        >
                          <div className="flex items-center gap-1 w-full">
                            <span className="font-black text-gray-900 text-[10px] group-hover:text-indigo-600 transition-colors truncate max-w-[110px]">
                              {serviceText}
                            </span>
                            <Briefcase size={9} className="text-indigo-500 opacity-60 group-hover:opacity-100 shrink-0 transition-all" />
                          </div>
                          <span className="text-[8px] font-bold text-gray-400 group-hover:text-indigo-500 flex items-center gap-0.5 transition-colors">
                            <MapPin size={8} className="text-blue-500 shrink-0" />
                            <span className="truncate max-w-[100px]">{locationText}</span>
                          </span>
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-1.5 py-2">
                    <div className="flex items-center gap-1 text-gray-900 font-black text-[10px]">
                      <CheckCircle2 size={11} className="text-green-600 shrink-0" />
                      <span>{provider.completed_jobs || 0}</span>
                      <span className="text-[8px] text-gray-400 font-bold">/{provider.total_jobs || 0}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2">
                    <div className="flex items-center gap-0.5 text-gray-900 font-black text-[10px]">
                      <Star size={11} className="text-amber-500 fill-amber-500" />
                      <span>
                        {provider.total_jobs && provider.total_jobs > 0
                          ? `${Math.round(((provider.completed_jobs || 0) / provider.total_jobs) * 100)}%`
                          : provider.overall_rating
                            ? `${Math.round((provider.overall_rating / 5) * 100)}%`
                            : '100%'}
                      </span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 font-black uppercase text-[8px] tracking-wider whitespace-nowrap">
                    {provider.isBusy ? (
                      <span className="text-amber-600 px-1 py-0.5 bg-amber-50 rounded border border-amber-200">Busy</span>
                    ) : provider.availability_status === 'available' ? (
                      <span className="text-green-600 px-1 py-0.5 bg-green-50 rounded border border-green-200">Available</span>
                    ) : (
                      <span className="text-gray-500 px-1 py-0.5 bg-gray-50 rounded border border-gray-200">Offline</span>
                    )}
                  </td>
                  <td className="px-1.5 py-2 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5 items-start">
                      <div className="flex items-center gap-1">
                        <span className="font-black text-gray-900 text-[10px]">
                          ₹{(provider.walletBalance || 0).toLocaleString('en-IN')}
                        </span>
                        {provider.walletStatus === 'frozen_manual' ? (
                          <span className="px-1 py-0.2 bg-red-100 text-red-800 font-black text-[7px] uppercase tracking-wider rounded border border-red-300">Frozen</span>
                        ) : provider.walletStatus === 'frozen_auto' ? (
                          <span className="px-1 py-0.2 bg-rose-100 text-rose-800 font-black text-[7px] uppercase tracking-wider rounded border border-rose-300">Frozen</span>
                        ) : null}
                      </div>
                      <span className={`px-1 py-0.2 text-[7.5px] font-black uppercase tracking-wider rounded border ${
                        provider.isFreeAccessEnabled
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : provider.subscriptionStatus === 'grace_period'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}>
                        {provider.isFreeAccessEnabled
                          ? (provider.subscriptionType === 'free_trial' ? 'Free Trial' : provider.accessMode || 'Free Access')
                          : 'Wallet Based'}
                      </span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 whitespace-nowrap">
                    <Badge variant={provider.kyc_status === 'verified' ? 'success' : provider.kyc_status === 'pending' ? 'warning' : 'danger'}>
                      {provider.kyc_status}
                    </Badge>
                  </td>
                  <td className="px-1.5 py-2 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setSelectedProvider(provider)} className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-all" title="View Details/Approve"><Eye size={12} /></button>
                      <button onClick={() => setSubscriptionModalProvider(provider)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-md transition-all" title="Manage Subscription & Free Access"><Gift size={12} /></button>
                      <button onClick={() => setWalletAdjustmentProvider(provider)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-all font-black text-[10px]" title="Credit / Debit Wallet">₹</button>
                      <button onClick={() => setWalletFreezeProvider(provider)} className={`p-1 rounded-md transition-all ${provider.walletStatus === 'frozen_manual' || provider.walletStatus === 'frozen_auto' ? 'text-red-600 hover:bg-red-50 font-black' : 'text-slate-600 hover:bg-slate-100'}`} title="Freeze / Unfreeze Wallet (Super Admin Only)"><Ban size={12} /></button>
                      <button onClick={() => { setAuditLogProviderId(provider._id); setAuditLogModalOpen(true); }} className="p-1 text-amber-600 hover:bg-amber-50 rounded-md transition-all" title="View Immutable Audit Logs"><FileSearch size={12} /></button>
                      {provider.isBusy && (
                        <button onClick={() => handleReleaseProvider(provider)} className="p-0.5 text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-md transition-all text-[7px] font-black uppercase tracking-wider px-1" title="Release Busy Provider">Release</button>
                      )}
                      <button onClick={() => setProviderToDelete(provider)} className="p-1 text-red-500 hover:bg-red-50 rounded-md transition-all" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </Table>
        </div>

        {/* Global Pagination Rail - Centered */}
        <div className="p-5 border-t border-gray-50 flex flex-col items-center gap-6 bg-gray-50/30">
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 disabled:opacity-30 shadow-sm transition-all"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[28px] h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-sm border ${currentPage === page
                      ? "bg-blue-600 text-white border-blue-600 shadow-blue-600/20"
                      : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                      }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg bg-white border border-gray-100 text-gray-400 hover:text-blue-600 disabled:opacity-30 shadow-sm transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteExpertModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onAdd={handleAddProvider}
      />

      {/* Verification Action / Details Modal */}
      {selectedProvider && (
        <ProviderDetailsModal
          isOpen={!!selectedProvider}
          provider={selectedProvider}
          onClose={() => setSelectedProvider(null)}
          onUpdateComplete={fetchProviders}
        />
      )}

      {/* Provider Services / Portfolio Modal */}
      {selectedProviderServices && (
        <ProviderServicesModal
          isOpen={!!selectedProviderServices}
          provider={selectedProviderServices}
          onClose={() => setSelectedProviderServices(null)}
          locations={locations}
          categories={categories}
          services={services}
          subservices={subservices}
        />
      )}

      {/* Subscription Management Modal */}
      {subscriptionModalProvider && (
        <SubscriptionManagementModal
          provider={subscriptionModalProvider}
          isOpen={!!subscriptionModalProvider}
          onClose={() => setSubscriptionModalProvider(null)}
          onSuccess={fetchProviders}
        />
      )}

      {/* Wallet Adjustment Modal */}
      {walletAdjustmentProvider && (
        <WalletAdjustmentModal
          provider={walletAdjustmentProvider}
          isOpen={!!walletAdjustmentProvider}
          onClose={() => setWalletAdjustmentProvider(null)}
          onSuccess={fetchProviders}
        />
      )}

      {/* Super Admin Wallet Freeze Modal */}
      {walletFreezeProvider && (
        <WalletFreezeModal
          provider={walletFreezeProvider}
          isOpen={!!walletFreezeProvider}
          onClose={() => setWalletFreezeProvider(null)}
          onSuccess={fetchProviders}
        />
      )}

      {/* Immutable Wallet Audit Logs Modal */}
      <WalletAuditLogModal
        providerId={auditLogProviderId}
        isOpen={auditLogModalOpen}
        onClose={() => { setAuditLogModalOpen(false); setAuditLogProviderId(null); }}
      />

      {/* Provider Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!providerToDelete}
        onClose={() => setProviderToDelete(null)}
        onConfirm={handleDeleteProvider}
        title="Provider Removal"
        message={`Are you sure you want to remove provider "${providerToDelete?.user_id?.name || (providerToDelete as any)?.business_name || 'this provider'}"? This operation will soft-delete their profile.`}
        confirmLabel="Remove Provider"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default ProviderTable;
