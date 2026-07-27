"use client";

import React, { useState, useEffect } from 'react';
import { Table, Typography, Button, Select, DatePicker, message, Pagination, Modal, Divider, Timeline, Tag, Input } from 'antd';
const { TextArea } = Input;
import { Download, Eye, CheckCircle, XCircle, ChevronRight, Clock, FileText, Check } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { API_URL } from '@/config/api';

const { RangePicker } = DatePicker;

export default function RefundsContent() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionAmount, setActionAmount] = useState<string | number>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const PAGE_SIZE = 6;

  const [dashboardStats, setDashboardStats] = useState([
    { title: 'Total Refund Requests', value: '0', subtitle: 'All Time', icon: <FileText size={18} />, color: 'bg-blue-100 text-blue-600' },
    { title: 'Pending Requests', value: '0', subtitle: 'This Month', icon: <Clock size={18} />, color: 'bg-orange-100 text-orange-600' },
    { title: 'Approved Refunds', value: '0', subtitle: 'This Month', icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600' },
    { title: 'Rejected Refunds', value: '0', subtitle: 'This Month', icon: <XCircle size={18} />, color: 'bg-red-100 text-red-600' },
    { title: 'Refunded Amount', value: '₹ 0', subtitle: 'This Month', icon: '₹', color: 'bg-emerald-100 text-emerald-600' },
  ]);

  const openActionModal = (type: string) => {
    setActionType(type);
    setActionMessage('');
    setActionAmount('');
    setActionModalVisible(true);
  };

  const handleActionConfirm = async () => {
    if (!selectedRefund) return;
    if (actionType === 'reject' && !actionMessage.trim()) {
      return message.error('Reason is required to reject a refund');
    }
    if (actionType === 'partial_refund' && !actionAmount) {
      return message.error('Refund amount is required');
    }
    if (actionType === 'partial_refund' && !actionMessage.trim()) {
      return message.error('Reason is required for partial refund');
    }

    try {
      const token = localStorage.getItem('token');
      let status = selectedRefund.status;
      if (actionType === 'request_info') status = 'info_requested';
      if (actionType === 'reject') status = 'rejected';
      if (actionType === 'partial_refund') status = 'approved';
      if (actionType === 'approve') status = 'approved';
      if (actionType === 'process') status = 'refunded';

      const amount = actionType === 'partial_refund' ? Number(actionAmount) : undefined;
      const reason = actionMessage || undefined;

      await axios.put(`${API_URL}/refunds/${selectedRefund.key}/status`, {
        status,
        amount,
        reason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      message.success(`Refund status updated to ${status} successfully`);
      setActionModalVisible(false);
      setIsModalVisible(false);
      fetchRefunds();
    } catch (error: any) {
      console.error('Error updating refund status:', error);
      message.error(error.response?.data?.message || 'Failed to update refund status');
    }
  };

  useEffect(() => {
    // Handle stuck redirect query parameters from dashboard
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      if (filterParam) setStatusFilter(filterParam);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
    fetchFilterData();
  }, [currentPage, statusFilter]);

  const fetchFilterData = async (attempt = 1) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const [categoriesRes, providersRes] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/providers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const catData = Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data?.data || []);
      const provData = Array.isArray(providersRes.data) ? providersRes.data : (providersRes.data?.data || []);
      setCategories(catData);
      setProviders(provData);
    } catch (error: any) {
      const status = error?.response?.status;
      const isTransient = status === 504 || status === 503 || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[RefundsContent] Filter data service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchFilterData(attempt + 1), delay);
      } else {
        console.warn('Error fetching filter data:', error?.message || error);
      }
    }
  };

  const exportCSV = () => {
    if (refunds.length === 0) return message.warning('No data to export');
    const headers = 'Refund ID,Booking ID,Customer,Provider,Amount Paid,Refund Amount,Refund Reason,Request Date,Status,Processed By,Processed Date';
    const csvRows = (refunds as any[]).map((r: any) =>
      `${r.refundId},${r.bookingId},${r.customer},${r.provider},${r.amountPaid},${r.refundAmount},"${r.reason}",${r.requestDate},${r.status},${r.processedBy},${r.processedDate}`
    );
    const blob = new Blob([[headers, ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `refunds_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const fetchRefunds = async (attempt = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const params: any = {
        page: currentPage,
        limit: PAGE_SIZE
      };
      if (statusFilter !== 'All') {
        params.status = statusFilter;
      }

      const response = await axios.get(`${API_URL}/refunds`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      let totalRefunded = 0;
      let totalCount = 0;
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      const rawRefunds = response.data?.data || [];
      const total = response.data?.total || 0;
      setTotalRows(total);

      const formattedData = rawRefunds.map((r: any) => {
        totalCount++;
        const status = r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Pending';
        if (status === 'Completed' || status === 'Refunded' || status === 'Approved') approvedCount++;
        else if (status === 'Pending' || status === 'Requested') pendingCount++;
        else if (status === 'Failed' || status === 'Rejected') rejectedCount++;

        if (status === 'Completed' || status === 'Refunded' || status === 'Approved') {
          totalRefunded += r.amount || 0;
        }

        return {
          key: r._id,
          refundId: `RF${r._id.substring(r._id.length - 6).toUpperCase()}`,
          bookingId: r.booking_id?.booking_id || r.booking_id || 'N/A',
          customer: r.user_id?.name || `User ${r.user_id ? r.user_id.substring(r.user_id.length - 4) : 'N/A'}`,
          provider: r.booking_id?.provider_id?.user_id?.name || 'Unassigned',
          amountPaid: r.original_amount || r.amount || 0,
          refundAmount: r.amount || 0,
          reason: r.refund_reason || r.reason || 'Not Specified',
          requestDate: new Date(r.createdAt).toLocaleDateString(),
          status: status,
          processedBy: r.processed_by_admin?.name || 'Admin',
          processedDate: r.processed_at ? new Date(r.processed_at).toLocaleDateString() : '--',
          raw: r
        };
      });

      setRefunds(formattedData);
      setDashboardStats([
        { title: 'Total Refund Requests', value: totalCount.toString(), subtitle: 'All Time', icon: <FileText size={18} />, color: 'bg-blue-100 text-blue-600' },
        { title: 'Pending Requests', value: pendingCount.toString(), subtitle: 'This Month', icon: <Clock size={18} />, color: 'bg-orange-100 text-orange-600' },
        { title: 'Approved Refunds', value: approvedCount.toString(), subtitle: 'This Month', icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600' },
        { title: 'Rejected Refunds', value: rejectedCount.toString(), subtitle: 'This Month', icon: <XCircle size={18} />, color: 'bg-red-100 text-red-600' },
        { title: 'Refunded Amount', value: `₹ ${totalRefunded.toLocaleString()}`, subtitle: 'This Month', icon: '₹', color: 'bg-emerald-100 text-emerald-600' },
      ]);
      setLoading(false);
    } catch (error: any) {
      const status = error?.response?.status;
      const isTransient = status === 504 || status === 503 || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[RefundsContent] Refunds service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchRefunds(attempt + 1), delay);
      } else {
        // ponytail: warn instead of console.error to avoid Next.js error overlay on transient outage
        console.warn('Error fetching refunds:', error?.message || error);
        setLoading(false);
      }
    }
  };

  const columns = [
    { title: 'Refund ID', dataIndex: 'refundId', key: 'refundId', render: (text: string) => <span className="text-blue-600 font-medium">{text}</span> },
    { title: 'Booking ID', dataIndex: 'bookingId', key: 'bookingId', render: (text: string) => <span className="text-blue-600 font-medium">{text}</span> },
    { title: 'Customer Name', dataIndex: 'customer', key: 'customer' },
    { title: 'Provider Name', dataIndex: 'provider', key: 'provider' },
    { title: 'Amount Paid', dataIndex: 'amountPaid', key: 'amountPaid', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Refund Amount', dataIndex: 'refundAmount', key: 'refundAmount', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Refund Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'Request Date', dataIndex: 'requestDate', key: 'requestDate' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let colorClass = 'bg-gray-100 text-gray-600';
        if (status === 'Approved' || status === 'Partially Approved' || status === 'Refunded') colorClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
        if (status === 'Pending' || status === 'Waiting For Information' || status === 'Requested') colorClass = 'bg-orange-50 text-orange-500 border border-orange-200';
        if (status === 'Rejected') colorClass = 'bg-red-50 text-red-500 border border-red-200';

        return <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${colorClass}`}>{status}</span>;
      }
    },
    { title: 'Processed By', dataIndex: 'processedBy', key: 'processedBy' },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-2 text-slate-400">
          <Eye
            size={16}
            className="cursor-pointer hover:text-blue-600"
            onClick={() => { setSelectedRefund(record); setIsModalVisible(true); }}
          />
        </div>
      ),
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Refunds Page</h1>
        <Link href="/admin/refund-policy" className="px-4 py-2 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1.5">
          <FileText size={14} /> Refund Policy
        </Link>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Status</label>
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              className="w-40 h-10 custom-select"
              options={[
                { value: 'All', label: 'All' },
                { value: 'requested', label: 'Requested' },
                { value: 'approved', label: 'Approved' },
                { value: 'refunded', label: 'Refunded' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>

        <Button onClick={exportCSV} icon={<Download size={16} />} className="h-10 px-4 rounded-lg border-blue-200 text-blue-600 font-medium hover:border-blue-600 hover:bg-blue-50">
          Export Report
        </Button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {dashboardStats.map((stat, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stat.color}`}>
              {typeof stat.icon === 'string' ? <span className="text-xl font-bold">{stat.icon}</span> : stat.icon}
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium mb-0.5">{stat.title}</p>
              <h3 className="text-lg font-bold text-slate-800 leading-none mb-1">{stat.value}</h3>
              <p className="text-[10px] text-slate-400">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
        <Table
          columns={columns}
          dataSource={refunds}
          rowKey="key"
          loading={loading}
          pagination={false}
          className="admin-exact-table"
        />

        {/* Footer Pagination */}
        <div className="flex justify-between items-center mt-4 mb-8 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-0">
            Showing {refunds.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, totalRows)} of {totalRows} entries
          </p>
          <Pagination
            current={currentPage}
            onChange={(page) => setCurrentPage(page)}
            total={totalRows}
            pageSize={PAGE_SIZE}
            showSizeChanger={false}
          />
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        title="Refund Request Details"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={750}
        className="refund-modal"
      >
        {selectedRefund && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Refund Request Details</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Refund ID</span>
                    <span className="font-bold text-slate-800">{selectedRefund.refundId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Booking ID</span>
                    <span className="font-bold text-slate-800">{selectedRefund.bookingId}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-bold text-slate-800">{selectedRefund.customer}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Status</span>
                    <span className="font-bold text-blue-600">{selectedRefund.status}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Reason</span>
                    <span className="font-bold text-slate-800">{selectedRefund.reason}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Financials</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount Paid</span>
                    <span className="font-bold text-gray-800">₹{selectedRefund.amountPaid}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-800">Approved Refund</span>
                    <span className="text-green-600 font-bold">₹{selectedRefund.refundAmount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              {(selectedRefund.raw?.status === 'requested' || selectedRefund.status === 'Requested') && (
                <>
                  <Button className="border-blue-300 text-blue-600 font-medium" onClick={() => openActionModal('request_info')}>Request Info</Button>
                  <Button danger className="font-medium" onClick={() => openActionModal('reject')}>Reject Refund</Button>
                  <Button className="border-orange-300 text-orange-600 font-medium" onClick={() => openActionModal('partial_refund')}>Partial Refund</Button>
                  <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => openActionModal('approve')}>Approve Full Refund</Button>
                </>
              )}
              {selectedRefund.raw?.status === 'approved' && (
                <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => openActionModal('process')}>Process to Gateway</Button>
              )}
              <Button className="border-slate-300 text-slate-600 font-medium" onClick={() => setIsModalVisible(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        open={actionModalVisible}
        onCancel={() => setActionModalVisible(false)}
        footer={null}
        title={
          actionType === 'request_info' ? 'Request Additional Information' :
            actionType === 'reject' ? 'Reject Refund' :
              actionType === 'partial_refund' ? 'Partial Refund' :
                actionType === 'approve' ? 'Approve Refund' :
                  actionType === 'process' ? 'Process Refund' : ''
        }
      >
        <div className="space-y-4 pt-4">
          {actionType === 'request_info' && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Message</label>
              <TextArea rows={4} value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} placeholder="Enter message for customer..." />
            </div>
          )}
          {actionType === 'reject' && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Reason *</label>
              <TextArea rows={4} value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} placeholder="Enter reason for rejection..." />
            </div>
          )}
          {actionType === 'partial_refund' && (
            <div className="space-y-4">
              <div className="flex justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600">Amount Paid</span>
                <span className="font-bold text-slate-800">₹{selectedRefund?.amountPaid || '0'}</span>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Refund Amount *</label>
                <Input type="number" prefix="₹" value={actionAmount} onChange={(e) => setActionAmount(e.target.value)} placeholder="Enter amount" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Reason *</label>
                <TextArea rows={3} value={actionMessage} onChange={(e) => setActionMessage(e.target.value)} placeholder="Enter reason for partial refund..." />
              </div>
            </div>
          )}
          {actionType === 'approve' && (
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
              <p className="text-sm text-slate-600 mb-1">Refund Amount</p>
              <h3 className="text-2xl font-black text-emerald-600">₹{selectedRefund?.refundAmount || selectedRefund?.amountPaid || '0'}</h3>
            </div>
          )}
          {actionType === 'process' && (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">This will initiate the refund through the payment gateway.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button onClick={() => setActionModalVisible(false)}>Cancel</Button>
            <Button
              type="primary"
              danger={actionType === 'reject'}
              className={actionType === 'partial_refund' ? 'bg-orange-500 hover:bg-orange-600' : actionType === 'approve' || actionType === 'process' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              onClick={handleActionConfirm}
            >
              {actionType === 'request_info' ? 'Send Request' :
                actionType === 'reject' ? 'Confirm Reject' :
                  actionType === 'partial_refund' ? 'Approve Partial Refund' :
                    actionType === 'approve' ? 'Confirm' :
                      actionType === 'process' ? 'Process Refund' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        .custom-select .ant-select-selector {
          border-radius: 8px !important;
          border-color: #e2e8f0 !important;
        }
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
        .custom-pagination .ant-pagination-item-active {
          background-color: #2563eb;
          border-color: #2563eb;
        }
        .custom-pagination .ant-pagination-item-active a {
          color: white !important;
        }
        .refund-modal .ant-modal-content {
          border-radius: 16px;
          padding: 24px;
        }
        .refund-modal .ant-modal-header {
          border-bottom: none;
          padding-bottom: 0;
        }
      `}</style>
    </div>
  );
}