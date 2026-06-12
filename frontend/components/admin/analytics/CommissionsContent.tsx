"use client";

import React, { useState, useEffect } from 'react';
import { Table, Button, message, Modal, Form, Select, Input, Popconfirm, Alert } from 'antd';
import { ChevronRight, Edit3, Trash2, Plus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { API_URL } from '@/config/api';
import ConfirmationModal from '../common/ConfirmationModal';

export default function CommissionsContent() {
  const [isAddModalVisible,  setIsAddModalVisible]  = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false);
  const [editingRecord,      setEditingRecord]      = useState<any>(null);
  const [commissionToDelete, setCommissionToDelete] = useState<any>(null);
  const [pendingBulkRate,    setPendingBulkRate]    = useState<number | null>(null);
  const [bulkLoading,        setBulkLoading]        = useState(false);
  const [addForm]  = Form.useForm();
  const [editForm] = Form.useForm();

  const [commissions,   setCommissions]   = useState<any[]>([]);
  const [dbCategories,  setDbCategories]  = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);

  const [dashboardStats, setDashboardStats] = useState([
    { label: 'Total Commission Earned', value: '₹ 0', sub: 'All Time', color: 'bg-blue-100 text-blue-600' },
    { label: 'This Month Earnings',     value: '₹ 0',   sub: 'Current Month', color: 'bg-emerald-100 text-emerald-600' },
    { label: "Today's Earnings",        value: '₹ 0',    sub: 'Today', color: 'bg-emerald-100 text-emerald-600' },
  ]);

  const earningsTrendData = [
    { date: '01 May', value: 25000 },
    { date: '08 May', value: 30000 },
    { date: '15 May', value: 50000 },
    { date: '22 May', value: 65000 },
    { date: '31 May', value: 45000 },
  ];

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    fetchCommissions();
    fetchCategories();
    fetchPaymentStats();
  }, []);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/commissions`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setCommissions(res.data || []);
    } catch {
      message.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`);
      setDbCategories(res.data || []);
    } catch {
      console.error('Error fetching categories');
    }
  };

  const fetchPaymentStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/payments`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const payments = res.data || [];
      
      let total = 0;
      let month = 0;
      let today = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const currentDateString = now.toDateString();

      payments.forEach((p: any) => {
        const status = p.payment_status ? p.payment_status.toLowerCase() : 'pending';
        // Only count completed/success payments
        if (status === 'completed' || status === 'success') {
          const amt = p.amount || 0;
          const commission = amt * 0.1; // Default 10% assumption for metrics if not tracked per-payment yet
          
          total += commission;

          const pDate = new Date(p.payment_date || p.createdAt);
          if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
            month += commission;
          }
          if (pDate.toDateString() === currentDateString) {
            today += commission;
          }
        }
      });

      setDashboardStats([
        { label: 'Total Commission Earned', value: `₹ ${total.toLocaleString()}`, sub: 'All Time', color: 'bg-blue-100 text-blue-600' },
        { label: 'This Month Earnings',     value: `₹ ${month.toLocaleString()}`, sub: now.toLocaleString('default', { month: 'short', year: 'numeric' }), color: 'bg-emerald-100 text-emerald-600' },
        { label: "Today's Earnings",        value: `₹ ${today.toLocaleString()}`, sub: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), color: 'bg-emerald-100 text-emerald-600' },
      ]);
    } catch (err) {
      console.error('Error fetching payment stats:', err);
    }
  };

  /* ─── ADD ─── */
  const handleAddSubmit = (values: any) => {
    const rate = Number(values.rate);
    if (values.category === 'All Categories') {
      // Show warning before bulk update
      setPendingBulkRate(rate);
      setIsAddModalVisible(false);
      setIsBulkModalVisible(true);
    } else {
      handleAddCommission(values.category, rate, values.status);
    }
  };

  const handleAddCommission = async (category_name: string, rate: number, status: string) => {
    try {
      await axios.post(`${API_URL}/commissions`,
        { category_name, rate, status },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      message.success('Commission added successfully');
      setIsAddModalVisible(false);
      addForm.resetFields();
      fetchCommissions();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to add commission');
    }
  };

  /* ─── BULK UPDATE ─── */
  const handleBulkUpdate = async () => {
    if (pendingBulkRate === null) return;
    try {
      setBulkLoading(true);
      const res = await axios.put(`${API_URL}/commissions/bulk-update`,
        { rate: pendingBulkRate },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const count = res.data.updatedCount;
      message.success({
        content: (
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" />
            {count} {count === 1 ? 'category' : 'categories'} updated to {pendingBulkRate}% successfully
          </span>
        ),
        duration: 4,
      });
      setIsBulkModalVisible(false);
      addForm.resetFields();
      setPendingBulkRate(null);
      fetchCommissions();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Bulk update failed');
    } finally {
      setBulkLoading(false);
    }
  };

  /* ─── EDIT ─── */
  const openEditModal = (record: any) => {
    setEditingRecord(record);
    editForm.setFieldsValue({ category: record.category_name, rate: record.rate, status: record.status });
    setIsEditModalVisible(true);
  };

  const handleEditCommission = async (values: any) => {
    try {
      await axios.put(`${API_URL}/commissions/${editingRecord._id}`,
        { category_name: values.category, rate: Number(values.rate), status: values.status },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      message.success('Commission updated successfully');
      setIsEditModalVisible(false);
      setEditingRecord(null);
      fetchCommissions();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to update commission');
    }
  };

  /* ─── DELETE ─── */
  const handleDeleteCommission = async (id: string) => {
    try {
      // No need to fetch immediately here, it will be done in the wrapper if needed, 
      // but actually we fetch manually so we can leave it.
      await axios.delete(`${API_URL}/commissions/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      message.success('Commission deleted successfully');
      setCommissionToDelete(null);
      fetchCommissions();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to delete commission');
    }
  };

  /* ─── TABLE COLUMNS ─── */
  const columns = [
    {
      title: 'Category',
      dataIndex: 'category_name',
      key: 'category_name',
      render: (text: string) => <span className="font-medium text-slate-700">{text}</span>,
    },
    {
      title: 'Commission (%)',
      dataIndex: 'rate',
      key: 'rate',
      render: (val: number) => (
        <span className="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-sm">
          {val}%
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span className={`text-xs font-bold ${status === 'active' ? 'text-emerald-500' : 'text-red-500'}`}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-3">
          <Edit3
            size={16}
            className="text-slate-400 cursor-pointer hover:text-blue-500 transition-colors"
            onClick={() => openEditModal(record)}
          />
          <Trash2 
            size={16} 
            className="text-red-400 cursor-pointer hover:text-red-600 transition-colors" 
            onClick={() => setCommissionToDelete(record)}
          />
        </div>
      ),
    },
  ];

  /* ─── SHARED FORM FIELDS ─── */
  const CommissionFormFields = ({ isEdit }: { isEdit?: boolean }) => (
    <>
      <Form.Item
        name="category"
        label={<span className="text-sm font-medium text-slate-700">Category Name</span>}
        rules={[{ required: true, message: 'Please select a category' }]}
      >
        <Select placeholder="Select Category" className="h-10 custom-select" disabled={isEdit}>
          {!isEdit && <Select.Option value="All Categories">⚡ All Categories</Select.Option>}
          {dbCategories
            .filter((cat: any) => isEdit || !commissions.some((c: any) => c.category_name === cat.category_name))
            .map((cat: any) => (
              <Select.Option key={cat._id} value={cat.category_name}>{cat.category_name}</Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="rate"
        label={<span className="text-sm font-medium text-slate-700">Commission Rate (%)</span>}
        rules={[{ required: true, message: 'Please enter commission rate' }]}
      >
        <Input type="number" placeholder="e.g. 15" className="h-10 rounded-lg" min={0} max={100} />
      </Form.Item>

      <Form.Item
        name="status"
        label={<span className="text-sm font-medium text-slate-700">Status</span>}
        rules={[{ required: true }]}
        initialValue="active"
      >
        <Select className="h-10">
          <Select.Option value="active">Active</Select.Option>
          <Select.Option value="inactive">Inactive</Select.Option>
        </Select>
      </Form.Item>
    </>
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto bg-[#FAFAFA] min-h-screen space-y-6">

      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 mb-1">Commission Management</h1>
          <div className="flex items-center text-sm text-slate-500">
            <Link href="/admin/dashboard" className="hover:text-blue-600">Finance</Link>
            <ChevronRight size={14} className="mx-1" />
            <span className="text-slate-700 font-medium">Commission Management</span>
          </div>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsAddModalVisible(true)}
          disabled={dbCategories.length > 0 && commissions.length >= dbCategories.length}
          className={`h-10 px-5 font-bold rounded-lg border-none ${
            dbCategories.length > 0 && commissions.length >= dbCategories.length 
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          Add New Commission
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-6">Commission by Service Category</h3>
          <Table
            columns={columns}
            dataSource={commissions}
            rowKey="_id"
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'No commission rules configured yet.' }}
            className="admin-exact-table"
          />
        </div>

        {/* Right: Cards + Chart */}
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-4">Commission Earnings Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {dashboardStats.map((card, i) => (
                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${card.color}`}>₹</div>
                  <div>
                    <p className="text-[10px] text-slate-500 font-bold mb-0.5 uppercase">{card.label}</p>
                    <p className="text-lg font-black text-slate-800 leading-none">{card.value}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex-1">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Commission Earnings Trend</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={earningsTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `₹${v.toLocaleString()}`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <RechartsTooltip formatter={(v: unknown) => [`₹${Number(v ?? 0).toLocaleString()}`, 'Earnings']} />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.08} fill="#3b82f6" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ── ADD Modal ── */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">Add New Commission</span>}
        open={isAddModalVisible}
        onCancel={() => { setIsAddModalVisible(false); addForm.resetFields(); }}
        footer={null}
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" onFinish={handleAddSubmit} className="mt-4">
          <CommissionFormFields />
          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={() => { setIsAddModalVisible(false); addForm.resetFields(); }} className="h-10 px-6 rounded-lg font-medium">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" className="h-10 px-6 rounded-lg bg-blue-600 font-medium">
              Add Commission
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── BULK UPDATE Warning Modal ── */}
      <Modal
        title={null}
        open={isBulkModalVisible}
        onCancel={() => { setIsBulkModalVisible(false); setPendingBulkRate(null); }}
        footer={null}
        width={460}
        destroyOnHidden
      >
        <div className="py-4">
          {/* Warning header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 mb-1">Update All Categories?</h3>
              <p className="text-sm text-slate-500">
                This will overwrite the commission percentage for <strong>all {dbCategories.length} existing categories</strong>. This action cannot be undone automatically.
              </p>
            </div>
          </div>

          {/* Summary box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium uppercase">New Commission Rate</span>
              <span className="text-2xl font-black text-blue-600">{pendingBulkRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium uppercase">Categories Affected</span>
              <span className="text-base font-bold text-slate-700">{dbCategories.length} categories</span>
            </div>
          </div>

          <Alert
            type="warning"
            showIcon
            title="Future categories will not inherit this rate automatically. You'll need to set them manually."
            className="mb-5 text-xs"
          />

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => { setIsBulkModalVisible(false); setPendingBulkRate(null); }}
              className="h-10 px-6 rounded-lg font-medium"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              loading={bulkLoading}
              onClick={handleBulkUpdate}
              className="h-10 px-6 rounded-lg bg-amber-500 hover:bg-amber-600 border-amber-500 font-bold"
            >
              Update All {dbCategories.length} Categories
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── EDIT Modal ── */}
      <Modal
        title={<span className="text-lg font-bold text-slate-800">Edit Commission</span>}
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setEditingRecord(null); editForm.resetFields(); }}
        footer={null}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditCommission} className="mt-4">
          <CommissionFormFields isEdit />
          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={() => { setIsEditModalVisible(false); editForm.resetFields(); }} className="h-10 px-6 rounded-lg font-medium">
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" className="h-10 px-6 rounded-lg bg-blue-600 font-medium">
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ── DELETE Confirmation Modal ── */}
      <ConfirmationModal
        isOpen={!!commissionToDelete}
        onClose={() => setCommissionToDelete(null)}
        onConfirm={() => handleDeleteCommission(commissionToDelete?._id)}
        title="Delete Commission"
        message={`Are you sure you want to remove the commission rule for "${commissionToDelete?.category_name}"?`}
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      <style jsx global>{`
        .admin-exact-table .ant-table-thead > tr > th {
          background: transparent !important;
          color: #1e293b !important;
          font-weight: 600 !important;
          font-size: 12px;
          border-bottom: 1px solid #f1f5f9;
          padding: 12px 16px;
        }
        .admin-exact-table .ant-table-tbody > tr > td {
          padding: 12px 16px;
          border-bottom: 1px solid #f8fafc;
          font-size: 13px;
          color: #334155;
        }
        .admin-exact-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
      `}</style>
    </div>
  );
}
