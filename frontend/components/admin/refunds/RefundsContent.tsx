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
  const PAGE_SIZE = 10;
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

  const handleActionConfirm = () => {
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

    const updatedRefunds = refunds.map((r: any) => {
      if (r.key === selectedRefund.key) {
        let newStatus = selectedRefund.status;
        if (actionType === 'request_info') newStatus = 'Waiting For Information';
        if (actionType === 'reject') newStatus = 'Rejected';
        if (actionType === 'partial_refund') newStatus = 'Partially Approved';
        if (actionType === 'approve') newStatus = 'Approved';
        if (actionType === 'process') newStatus = 'Refunded';
        return { ...r, status: newStatus };
      }
      return r;
    });

    setRefunds(updatedRefunds as any);
    setSelectedRefund({
      ...selectedRefund,
      status: actionType === 'request_info' ? 'Waiting For Information'
        : actionType === 'reject' ? 'Rejected'
          : actionType === 'partial_refund' ? 'Partially Approved'
            : actionType === 'approve' ? 'Approved'
              : actionType === 'process' ? 'Refunded'
                : selectedRefund.status
    });

    setActionModalVisible(false);
    message.success(`Action successful`);
  };

  useEffect(() => {
    fetchRefunds();
    fetchFilterData();
  }, []);

  const fetchFilterData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [categoriesRes, providersRes] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/providers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      // Handle both raw array and paginated { data: [] } response shapes
      const catData = Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data?.data || []);
      const provData = Array.isArray(providersRes.data) ? providersRes.data : (providersRes.data?.data || []);
      setCategories(catData);
      setProviders(provData);
    } catch (error) {
      console.error('Error fetching filter data:', error);
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

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/refunds`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let totalRefunded = 0;
      let totalCount = 0;
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      const rawRefunds = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const formattedData = rawRefunds.map((r: any) => {
        totalCount++;
        const status = r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Pending';
        if (status === 'Completed' || status === 'Refunded' || status === 'Approved') approvedCount++;
        else if (status === 'Pending' || status === 'Processing') pendingCount++;
        else if (status === 'Failed' || status === 'Rejected') rejectedCount++;

        if (status === 'Completed' || status === 'Refunded' || status === 'Approved') {
          totalRefunded += r.amount || 0;
        }

        return {
          key: r._id,
          refundId: `RF${r._id.substring(r._id.length - 6).toUpperCase()}`,
          bookingId: r.booking_id || 'N/A',
          customer: `User ${r.user_id ? r.user_id.substring(r.user_id.length - 4) : 'N/A'}`,
          provider: 'Provider',
          amountPaid: r.amount || 0,
          refundAmount: r.amount || 0,
          reason: r.reason || 'Not Specified',
          requestDate: new Date(r.createdAt).toLocaleDateString(),
          status: status,
          processedBy: 'Admin',
          processedDate: new Date(r.updatedAt).toLocaleDateString()
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
    } catch (error) {
      console.error('Error fetching refunds:', error);
      message.error('Failed to load refunds from database');
      setLoading(false);
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
        if (status === 'Pending' || status === 'Waiting For Information') colorClass = 'bg-orange-50 text-orange-500 border border-orange-200';
        if (status === 'Rejected') colorClass = 'bg-red-50 text-red-500 border border-red-200';

        return <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${colorClass}`}>{status}</span>;
      }
    },
    { title: 'Processed By', dataIndex: 'processedBy', key: 'processedBy' },
    { title: 'Processed Date', dataIndex: 'processedDate', key: 'processedDate' },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => (
        <Eye
          size={18}
          className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors"
          onClick={() => { setSelectedRefund(record); setIsModalVisible(true); }}
        />
      ),
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Refunds Page</h1>
      </div>


      {/* Filters Row */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Refund Status</label>
            <Select defaultValue="All" className="w-32 h-10 custom-select" options={[{ value: 'All', label: 'All' }]} />
          </div>

          <RangePicker className="h-10 rounded-lg border-slate-200" placeholder={['01 May 2024', '31 May 2024']} format="DD MMM YYYY" />

          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Provider</label>
            <Select
              defaultValue="All Providers"
              className="w-36 h-10 custom-select"
              options={[
                { value: 'All Providers', label: 'All Providers' },
                ...providers.map(p => ({ value: p._id, label: p.user_id?.name || 'Unknown' }))
              ]}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Service Category</label>
            <Select
              defaultValue="All"
              className="w-32 h-10 custom-select"
              options={[
                { value: 'All', label: 'All' },
                ...categories.map(c => ({ value: c._id, label: c.category_name }))
              ]}
            />
          </div>
        </div>

        <Button onClick={exportCSV} icon={<Download size={16} />} className="h-10 px-4 rounded-lg border-blue-200 text-blue-600 font-medium hover:border-blue-600 hover:bg-blue-50">
          Export Report
        </Button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
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

        {/* Table */}
        <Table
          columns={columns}
          dataSource={refunds.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
          rowKey="key"
          loading={loading}
          pagination={false}
          className="admin-exact-table"
        />

        {/* Footer Pagination */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-0">
            Showing {refunds.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, refunds.length)} of {refunds.length} entries
          </p>
          <Pagination
            current={currentPage}
            total={refunds.length}
            pageSize={PAGE_SIZE}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            className="custom-pagination"
          />
        </div>
      </div>

      {/* Refund Details Modal matching user spec */}
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={1000}
        centered
        closeIcon={<span className="text-slate-400 text-lg hover:text-slate-800">✕</span>}
        className="refund-modal"
        title={
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Refund Details</h2>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="pt-2 space-y-6">

            {/* Row 1: Refund Info & Payment Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">Refund Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Refund ID</span><span className="text-sm font-medium text-slate-800">{selectedRefund?.refundId || 'REF202600123'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Refund Status</span><span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{selectedRefund?.status || 'Pending'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Request Date</span><span className="text-sm font-medium text-slate-800">{selectedRefund?.requestDate || '15 Jun 2026'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Refund Type</span><span className="text-sm font-medium text-slate-800">Full Refund</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Refund Amount</span><span className="text-sm font-medium text-slate-800">₹{selectedRefund?.refundAmount || '1,200'}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">Payment Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment ID</span><span className="text-sm font-medium text-slate-800">PAY202600567</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Transaction ID</span><span className="text-sm font-medium text-slate-800">TXN784512369</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment Method</span><span className="text-sm font-medium text-slate-800">UPI</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Amount Paid</span><span className="text-sm font-medium text-slate-800">₹{selectedRefund?.amountPaid || '1,200'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment Date</span><span className="text-sm font-medium text-slate-800">14 Jun 2026</span></div>
                </div>
              </div>
            </div>

            {/* Row 2: Customer & Provider Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Customer Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Customer Name</span><span className="text-sm font-medium text-slate-800">{selectedRefund?.customer || 'Swathi P'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Email</span><span className="text-sm font-medium text-slate-800">swathi@gmail.com</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Phone</span><span className="text-sm font-medium text-slate-800">+91 9876543210</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Location</span><span className="text-sm font-medium text-slate-800">KR Puram, Bangalore</span></div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Provider Information</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Provider Name</span><span className="text-sm font-medium text-slate-800">{selectedRefund?.provider || 'Arun Services'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Provider ID</span><span className="text-sm font-medium text-slate-800">PROV1025</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Phone</span><span className="text-sm font-medium text-slate-800">+91 9876541230</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Category</span><span className="text-sm font-medium text-slate-800">AC Repair Services</span></div>
                </div>
              </div>
            </div>

            {/* Row 3: Booking Info */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800">Booking Information</h3>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Booking ID</span><span className="text-sm font-medium text-slate-800">{selectedRefund?.bookingId || 'BK202600789'}</span></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Service</span><span className="text-sm font-medium text-slate-800">AC Repair</span></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Sub-Service</span><span className="text-sm font-medium text-slate-800">Gas Refilling</span></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Booking Date</span><span className="text-sm font-medium text-slate-800">14 Jun 2026</span></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Scheduled Date</span><span className="text-sm font-medium text-slate-800">15 Jun 2026</span></div>
                <div className="flex flex-col"><span className="text-xs text-slate-500 mb-0.5">Booking Status</span><span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md w-fit">Cancelled</span></div>
              </div>
            </div>

            {/* Row 4: Refund Reason & Calculation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Refund Reason</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs text-slate-500 block mb-2">Reason Category</span>
                    <div className="flex flex-wrap gap-2">
                      <Tag color="red">Provider Did Not Arrive</Tag>
                    </div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                    <span className="text-xs font-bold text-red-800 block mb-1">Selected Reason Details</span>
                    <p className="text-xs text-red-700 m-0">Provider did not arrive at the scheduled time. Customer waited for 2 hours and cancelled booking.</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-500">Evidence / Attachments</span>
                      <div className="flex gap-2">
                        <Button size="small" type="link" className="text-[10px] p-0 h-auto">View</Button>
                        <Button size="small" type="link" className="text-[10px] p-0 h-auto">Download</Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-12 h-12 bg-slate-200 rounded-md flex items-center justify-center text-[8px] text-slate-500 border border-slate-300">Image 1</div>
                      <div className="w-12 h-12 bg-slate-200 rounded-md flex items-center justify-center text-[8px] text-slate-500 border border-slate-300">Image 2</div>
                      <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center text-[10px] text-red-600 font-bold border border-red-200">PDF</div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Refund Calculation</h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-white">
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between"><span className="text-xs text-slate-600">Amount Paid</span><span className="text-sm font-medium text-slate-800">₹{selectedRefund?.amountPaid || '1,200'}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-600">Platform Fee</span><span className="text-sm font-medium text-slate-800">₹100</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-600">Cancellation Fee</span><span className="text-sm font-medium text-slate-800">₹50</span></div>
                    <Divider className="my-2" />
                    <div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-800">Refund Eligible</span><span className="text-lg font-black text-emerald-600">₹1,050</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 5: Provider Response & Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Provider Response</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <span className="text-xs font-bold text-slate-700 block mb-1">Provider Statement</span>
                  <p className="text-xs text-slate-600 m-0 italic">"Customer was unavailable at location. Multiple calls were unanswered."</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block mb-2">Attachments (Call Logs / Screenshots)</span>
                  <div className="flex gap-2">
                    <div className="w-12 h-12 bg-slate-200 rounded-md flex items-center justify-center text-[8px] text-slate-500 border border-slate-300">Call Log</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Timeline</h3>
                <Timeline
                  items={[
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">14 Jun 2026</p><p className="text-xs font-medium text-slate-700">Booking Created & Payment Successful</p></> },
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">15 Jun 2026</p><p className="text-xs font-medium text-slate-700">Service Scheduled</p></> },
                    { color: 'orange', content: <><p className="text-[11px] text-slate-400 mb-0">15 Jun 2026</p><p className="text-xs font-bold text-orange-600">Refund Requested & Under Review</p></> },
                    { color: 'gray', content: <><p className="text-[11px] text-slate-400 mb-0">Pending</p><p className="text-xs font-medium text-slate-500">Admin Decision</p></> },
                  ]}
                />
              </div>
            </div>

            {/* Row 6: Admin Notes */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Internal Notes (Admin Only)</h3>
              <textarea
                className="w-full h-24 p-3 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700"
                placeholder="Add notes..."
                defaultValue={"Customer is genuine.\nProvider has previous complaints.\nApprove refund."}
              ></textarea>
            </div>

          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-xl">
          {selectedRefund?.status === 'Pending' && (
            <>
              <Button className="border-slate-300 text-slate-600 font-medium" onClick={() => openActionModal('request_info')}>Request More Info</Button>
              <Button danger className="font-medium" onClick={() => openActionModal('reject')}>Reject Refund</Button>
              <Button className="bg-orange-500 text-white font-medium border-none hover:bg-orange-600" onClick={() => openActionModal('partial_refund')}>Partial Refund</Button>
              <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => openActionModal('approve')}>Approve Refund</Button>
            </>
          )}
          {selectedRefund?.status === 'Waiting For Information' && (
            <>
              <Button className="border-blue-300 text-blue-600 font-medium">View Customer Response</Button>
              <Button danger className="font-medium" onClick={() => openActionModal('reject')}>Reject Refund</Button>
              <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => openActionModal('approve')}>Approve Refund</Button>
            </>
          )}
          {(selectedRefund?.status === 'Approved' || selectedRefund?.status === 'Partially Approved') && (
            <Button type="primary" className="bg-blue-600 hover:bg-blue-700 font-medium border-none" onClick={() => openActionModal('process')}>Process Refund</Button>
          )}
          {selectedRefund?.status === 'Refunded' && (
            <>
              <Button className="border-blue-300 text-blue-600 font-medium">Download Receipt</Button>
              <Button className="border-blue-300 text-blue-600 font-medium">View Transaction</Button>
            </>
          )}
          {selectedRefund?.status === 'Rejected' && (
            <Button className="border-red-300 text-red-600 font-medium">View Reason</Button>
          )}
          <Button className="border-slate-300 text-slate-600 font-medium ml-2" onClick={() => setIsModalVisible(false)}>Close</Button>
        </div>
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
                <span className="font-bold text-slate-800">₹{selectedRefund?.amountPaid || '1,200'}</span>
              </div>
              <div className="flex justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600">Eligible Amount</span>
                <span className="font-bold text-slate-800">₹{Math.max((selectedRefund?.amountPaid || 1200) - 150, 0)}</span>
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
              <h3 className="text-2xl font-black text-emerald-600">₹{selectedRefund?.refundAmount || selectedRefund?.amountPaid || '1,050'}</h3>
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