"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  DollarSign,
  ArrowUpRight,
  Download,
  Filter,
  Search,
  ExternalLink,
  Info,
  Gift
} from 'lucide-react';
import { 
  Modal, 
  Button, 
  Table, 
  Tag, 
  Space, 
  Input, 
  message, 
  Card,
  Avatar,
  Tooltip
} from 'antd';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import axios from 'axios';
import { API_URL } from '@/config/api';

interface CouponAnalyticsProps {
  coupon: any;
  onClose: () => void;
}

const CouponAnalytics: React.FC<CouponAnalyticsProps> = ({ coupon, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [searchUser, setSearchUser] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, [coupon._id]);

  const fetchAnalytics = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${API_URL}/admin/coupons/${coupon._id}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      message.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'User',
      dataIndex: 'userId',
      key: 'user',
      render: (user: any) => (
        <div className="flex items-center gap-3">
          <Avatar src={user.profile_image} className="bg-blue-100 text-blue-600 font-bold">
            {user.name?.[0]}
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-black text-gray-800">{user.name}</span>
            <span className="text-[10px] text-gray-400 font-bold uppercase">{user.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'booking',
      render: (booking: any) => (
        <Tag className="rounded-lg font-black bg-gray-50 border-gray-100 text-gray-600 px-3 py-1">
          #{booking?.booking_id || 'N/A'}
        </Tag>
      ),
    },
    {
      title: 'Order Amount',
      dataIndex: 'bookingId',
      key: 'amount',
      render: (booking: any) => (
        <span className="font-black text-gray-800">₹{booking?.total_amount || 0}</span>
      ),
    },
    {
      title: 'Discount Applied',
      dataIndex: 'discountApplied',
      key: 'discount',
      render: (discount: number) => (
        <span className="font-black text-emerald-600">- ₹{discount}</span>
      ),
    },
    {
      title: 'Used At',
      dataIndex: 'usedAt',
      key: 'date',
      render: (date: string) => (
        <span className="text-xs font-bold text-gray-500">
          {new Date(date).toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: () => (
        <Button type="text" icon={<ExternalLink size={16} />} className="text-blue-600" />
      ),
    },
  ];

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      width={1000}
      className="analytics-modal"
      closeIcon={<div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-all"><X size={18} /></div>}
      styles={{ body: { padding: 0, overflow: 'hidden', backgroundColor: '#F9FAFB' } }}
    >
      <div className="flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-white p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 leading-none uppercase tracking-tight">
                Coupon Analytics: {coupon.code}
              </h2>
              <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-2">
                Performance tracking for campaign <span className="text-blue-600">"{coupon.name}"</span>
              </p>
            </div>
          </div>
          <Button icon={<Download size={16} />} className="rounded-xl font-bold h-10 px-6 flex items-center gap-2">
            EXPORT REPORT
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Redemptions', value: data?.summary?.totalRedemptions || 0, icon: CheckCircle, color: 'emerald' },
              { label: 'Revenue Generated', value: `₹${data?.summary?.revenueGenerated?.toLocaleString() || 0}`, icon: DollarSign, color: 'blue' },
              { label: 'Discount Given', value: `₹${data?.summary?.totalDiscount?.toLocaleString() || 0}`, icon: Gift, color: 'purple' },
              { label: 'Conversion', value: `${data?.summary?.conversionRate || 0}%`, icon: ArrowUpRight, color: 'orange' },
            ].map((stat, idx) => (
              <Card key={idx} className="rounded-2xl shadow-sm border-none bg-white">
                <div className="flex flex-col">
                  <div className={`w-8 h-8 rounded-lg bg-${stat.color}-50 flex items-center justify-center text-${stat.color}-600 mb-3`}>
                    {React.createElement(stat.icon, { size: 16 })}
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                  <span className="text-xl font-black text-gray-900 mt-1">{stat.value}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            <Card title={<span className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2"><TrendingUp size={14} className="text-blue-600" /> Redemption Trend</span>} className="rounded-2xl shadow-sm border-none h-80">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.dailyUsage || []}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            <Card title={<span className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center gap-2"><DollarSign size={14} className="text-emerald-600" /> Revenue Impact</span>} className="rounded-2xl shadow-sm border-none h-80">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.dailyUsage || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                  />
                  <Bar dataKey="discount" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Usage Table */}
          <Card 
            title={
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-black text-gray-800 uppercase tracking-widest">Recent Redemptions</span>
                <div className="flex items-center gap-3">
                  <Input 
                    prefix={<Search size={14} className="text-gray-400" />}
                    placeholder="Search user..."
                    className="rounded-lg h-9 w-64 text-xs font-medium"
                    onChange={(e) => setSearchUser(e.target.value)}
                  />
                  <Button icon={<Filter size={14} />} className="rounded-lg h-9 w-9 flex items-center justify-center p-0" />
                </div>
              </div>
            }
            className="rounded-2xl shadow-sm border-none mb-4"
          >
            <Table 
              columns={columns} 
              dataSource={data?.redemptions?.filter((r: any) => r.userId.name.toLowerCase().includes(searchUser.toLowerCase()))} 
              pagination={{ pageSize: 5 }}
              loading={loading}
              className="custom-table"
            />
          </Card>
        </div>
      </div>

      <style jsx global>{`
        .analytics-modal .ant-modal-content {
          border-radius: 32px;
          overflow: hidden;
        }
        .custom-table .ant-table-thead > tr > th {
          background-color: #F9FAFB;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #94A3B8;
          border-bottom: 1px solid #F1F5F9;
        }
        .custom-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid #F8FAFC;
          padding: 16px;
        }
        .custom-table .ant-table-tbody > tr:hover > td {
          background-color: #F8FAFC;
        }
      `}</style>
    </Modal>
  );
};

export default CouponAnalytics;
