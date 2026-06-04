"use client";

import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  Plus, 
  Search, 
  Filter, 
  Copy, 
  Edit2, 
  Trash2, 
  Eye, 
  Power,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  MoreVertical,
  Calendar,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Select, Tag, Tooltip, Modal, Tabs, Card, Empty, Space, App } from 'antd';
import axios from 'axios';
import { API_URL } from '@/config/api';
import CouponModal from '@/components/admin/offers/CouponModal';
import CouponAnalytics from '@/components/admin/offers/CouponAnalytics';
import CouponCard from '@/components/admin/offers/CouponCard';
import ConfirmationModal from '../common/ConfirmationModal';

const OffersManagement = () => {
  const { message: messageApi } = App.useApp();
  const [activeTab, setActiveTab] = useState('coupons');
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeOffers: 0,
    totalRedemptions: 0,
    totalDiscountGiven: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [analyticsCoupon, setAnalyticsCoupon] = useState<any>(null);
  const [couponToDelete, setCouponToDelete] = useState<any>(null);
  const [couponToToggle, setCouponToToggle] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const [couponsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/coupons`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/admin/coupons/stats`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCoupons(couponsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      messageApi.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!couponToDelete) return;
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`${API_URL}/admin/coupons/${couponToDelete._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      messageApi.success('Coupon deleted successfully');
      fetchData();
    } catch (error) {
      messageApi.error('Failed to delete coupon');
    } finally {
      setCouponToDelete(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!couponToToggle) return;
    const token = localStorage.getItem('token');
    const newStatus = couponToToggle.status === 'active' ? 'inactive' : 'active';
    try {
      await axios.put(`${API_URL}/admin/coupons/${couponToToggle._id}`, 
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      messageApi.success(`Coupon ${newStatus === 'active' ? 'enabled' : 'disabled'} successfully`);
      fetchData();
    } catch (error) {
      messageApi.error('Failed to update coupon status');
    } finally {
      setCouponToToggle(null);
    }
  };

  const filteredCoupons = coupons.filter((coupon: any) => {
    const matchesSearch = (coupon.code?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                         (coupon.name?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || coupon.status === statusFilter;
    
    if (activeTab === 'auto') return coupon.autoApply && matchesSearch && matchesStatus;
    if (activeTab === 'expired') return coupon.status === 'expired' && matchesSearch;
    return !coupon.autoApply && matchesSearch && matchesStatus;
  });

  const tabItems = [
    {
      key: 'coupons',
      label: (
        <span className="flex items-center gap-2 px-1">
          <Ticket size={16} /> Available Coupons
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <AnimatePresence>
            {filteredCoupons.length > 0 ? (
              filteredCoupons.map((coupon: any) => (
                <CouponCard 
                  key={coupon._id} 
                  coupon={coupon} 
                  onEdit={() => {
                    setEditingCoupon(coupon);
                    setIsModalOpen(true);
                  }}
                  onDelete={() => setCouponToDelete(coupon)}
                  onToggle={() => setCouponToToggle(coupon)}
                  onViewAnalytics={() => setAnalyticsCoupon(coupon)}
                />
              ))
            ) : (
              <div className="col-span-full py-20 bg-white rounded-[2rem] border border-dashed border-gray-200 flex flex-col items-center">
                <Empty description={
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-lg font-black text-gray-900 uppercase">No offers found</span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Adjust your filters or create a new campaign</span>
                  </div>
                } />
              </div>
            )}
          </AnimatePresence>
        </div>
      )
    },
    {
      key: 'auto',
      label: (
        <span className="flex items-center gap-2 px-1">
          <Zap size={16} /> Auto-Applied Offers
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredCoupons.filter((c: any) => c.autoApply).map((coupon: any) => (
            <CouponCard 
              key={coupon._id} 
              coupon={coupon} 
              onEdit={() => {
                setEditingCoupon(coupon);
                setIsModalOpen(true);
              }}
              onDelete={() => setCouponToDelete(coupon)}
              onToggle={() => setCouponToToggle(coupon)}
              onViewAnalytics={() => setAnalyticsCoupon(coupon)}
            />
          ))}
        </div>
      )
    },
    {
      key: 'expired',
      label: (
        <span className="flex items-center gap-2 px-1">
          <Clock size={16} /> Expired / Disabled
        </span>
      ),
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredCoupons.filter((c: any) => c.status === 'expired' || c.status === 'inactive').map((coupon: any) => (
            <CouponCard 
              key={coupon._id} 
              coupon={coupon} 
              onEdit={() => {
                setEditingCoupon(coupon);
                setIsModalOpen(true);
              }}
              onDelete={() => setCouponToDelete(coupon)}
              onToggle={() => setCouponToToggle(coupon)}
              onViewAnalytics={() => setAnalyticsCoupon(coupon)}
            />
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20">
              <Ticket className="text-white" size={28} />
            </div>
            OFFERS & <span className="text-blue-600">COUPONS</span>
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">Manage promotional offers, discounts, coupon campaigns, and redemption analytics.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { setEditingCoupon(null); setIsModalOpen(true); }}
            className="h-10 px-6 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/20 border border-blue-600 flex items-center gap-2 hover:bg-white hover:text-blue-600 transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Coupon
          </button>
          <button 
            onClick={() => { setEditingCoupon({ autoApply: true }); setIsModalOpen(true); }}
            className="h-10 px-6 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-600/20 border border-blue-600 flex items-center gap-2 hover:bg-white hover:text-blue-600 transition-all cursor-pointer"
          >
            <Zap size={16} /> Add Auto Offer
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Coupons', value: stats.totalCoupons, icon: Ticket, color: 'blue' },
          { label: 'Active Offers', value: stats.activeOffers, icon: Zap, color: 'amber' },
          { label: 'Coupons Redeemed', value: stats.totalRedemptions, icon: CheckCircle, color: 'emerald' },
          { label: 'Total Discount Given', value: `₹${stats.totalDiscountGiven.toLocaleString()}`, icon: IndianRupee, color: 'purple' }
        ].map((stat, i) => (
          <Card key={i} className="rounded-[2rem] border-none shadow-sm hover:shadow-md transition-all overflow-hidden relative group">
            <div className={`absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform`}>
              <stat.icon size={80} />
            </div>
            <div className="space-y-1 relative z-10">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{stat.label}</span>
              <h3 className="text-2xl font-black text-gray-900">{stat.value}</h3>
            </div>
          </Card>
        ))}
      </div>

      {/* Management Area */}
      <div className="pt-2">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                placeholder="Search by code or name..." 
                className="h-11 pl-12 rounded-xl bg-gray-50 border-gray-100 font-medium"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select 
              defaultValue="all" 
              onChange={setStatusFilter}
              className="h-11 min-w-[140px] rounded-xl"
              classNames={{ popup: { root: 'rounded-xl' } }}
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="inactive">Inactive</Select.Option>
              <Select.Option value="expired">Expired</Select.Option>
            </Select>
          </div>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          className="offers-tabs custom-tabs"
          items={tabItems}
        />
      </div>

      {/* Modals */}
      <CouponModal 
        isOpen={isModalOpen} 
        onClose={() => {
          setIsModalOpen(false);
          setEditingCoupon(null);
        }} 
        onSuccess={() => {
          setIsModalOpen(false);
          setEditingCoupon(null);
          fetchData();
        }}
        editingCoupon={editingCoupon}
      />

      {analyticsCoupon && (
        <CouponAnalytics 
          coupon={analyticsCoupon} 
          onClose={() => setAnalyticsCoupon(null)} 
        />
      )}

      <ConfirmationModal
        isOpen={!!couponToDelete}
        onClose={() => setCouponToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Coupon?"
        message={`Are you sure you want to delete "${couponToDelete?.name}"? This will permanently remove the campaign and all redemption analytics.`}
        confirmLabel="DELETE CAMPAIGN"
        cancelLabel="KEEP IT"
      />

      <ConfirmationModal
        isOpen={!!couponToToggle}
        onClose={() => setCouponToToggle(null)}
        onConfirm={handleToggleStatus}
        title={couponToToggle?.status === 'active' ? 'Disable Offer?' : 'Enable Offer?'}
        message={`Are you sure you want to ${couponToToggle?.status === 'active' ? 'disable' : 'enable'} the "${couponToToggle?.name}" offer? Users will ${couponToToggle?.status === 'active' ? 'no longer be able to' : 'once again be able to'} redeem this code.`}
        confirmLabel={couponToToggle?.status === 'active' ? 'DISABLE OFFER' : 'ENABLE OFFER'}
        cancelLabel="CANCEL"
        variant={couponToToggle?.status === 'active' ? 'danger' : 'success'}
      />

      <style jsx global>{`
        .custom-tabs .ant-tabs-nav::before {
          border-bottom: 2px solid #f8fafc;
        }
        .custom-tabs .ant-tabs-tab {
          padding: 16px 0;
          margin: 0 32px 0 0;
        }
        .custom-tabs .ant-tabs-tab-btn {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #94a3b8;
        }
        .custom-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #2563eb !important;
        }
        .custom-tabs .ant-tabs-ink-bar {
          background: #2563eb;
          height: 3px !important;
          border-radius: 3px 3px 0 0;
        }
      `}</style>
    </div>
  );
};

const IndianRupee = ({ size }: { size: number }) => (
  <span style={{ fontSize: size, fontWeight: 900 }}>₹</span>
);

export default function OffersManagementWrapper() {
  return (
    <App>
      <OffersManagement />
    </App>
  );
}
