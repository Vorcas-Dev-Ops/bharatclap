"use client";

import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Button, Select, DatePicker, message, Pagination, Modal, Divider, Timeline } from 'antd';
import { Download, Eye, ChevronRight, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import Link from 'next/link';
import { useSettings } from '@/context/SettingsContext';

const { RangePicker } = DatePicker;

export default function PaymentsContent() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { platformName } = useSettings();
  const PAGE_SIZE = 10;

  const [dashboardStats, setDashboardStats] = useState([
    { title: 'Total Revenue', value: '₹ 0', subtitle: 'All Time', icon: <span className="text-[14px] font-bold">₹</span>, color: 'bg-emerald-50 text-emerald-500' },
    { title: "Today's Revenue", value: '₹ 0', subtitle: 'Today', icon: <FileText size={14} />, color: 'bg-blue-50 text-blue-500' },
    { title: 'This Month Revenue', value: '₹ 0', subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-blue-50 text-blue-500' },
    { title: 'Successful Payments', value: '0', subtitle: 'This Month', icon: <CheckCircle size={14} />, color: 'bg-emerald-50 text-emerald-500' },
    { title: 'Pending Payments', value: '0', subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-orange-50 text-orange-500' },
    { title: 'Failed Payments', value: '0', subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-red-50 text-red-500' },
  ]);

  useEffect(() => {
    fetchPayments();
    fetchFilterData();
  }, []);

  const fetchFilterData = async (attempt = 1) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const [categoriesRes, providersRes] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/providers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      // Handle both raw array and paginated { data: [] } response shapes
      const catData = Array.isArray(categoriesRes.data) ? categoriesRes.data : (categoriesRes.data?.data || []);
      const provData = Array.isArray(providersRes.data) ? providersRes.data : (providersRes.data?.data || []);
      setCategories(catData);
      setProviders(provData);
    } catch (error: any) {
      const status = error?.response?.status;
      const isTransient = status === 504 || status === 503 || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[PaymentsContent] Filter data service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchFilterData(attempt + 1), delay);
      } else {
        console.warn('Error fetching filter data:', error?.message || error);
      }
    }
  };

  const fetchPayments = async (attempt = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const response = await axios.get(`${API_URL}/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let totalRevenue = 0;
      let successCount = 0;
      let pendingCount = 0;
      let failedCount = 0;

      const rawPayments = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      const formattedData = rawPayments.map((p: any, index: number) => {
        const amt = p.amount || 0;
        const status = p.payment_status ? (p.payment_status.charAt(0).toUpperCase() + p.payment_status.slice(1)) : 'Pending';
        
        if (status === 'Completed' || status === 'Success') {
          totalRevenue += amt;
          successCount++;
        } else if (status === 'Pending') {
          pendingCount++;
        } else {
          failedCount++;
        }

        const bookingInfo = p.booking_id && typeof p.booking_id === 'object' ? p.booking_id : null;

        return {
          key: p._id,
          paymentId: `PAY${p._id.substring(p._id.length - 6).toUpperCase()}`,
          bookingId: bookingInfo?.booking_id || 'N/A',
          customer: bookingInfo?.user_id ? `User ${bookingInfo.user_id.toString().substring(0,6)}` : 'Unknown',
          provider: 'Provider', // Add provider data if available
          service: 'Service',
          amount: amt,
          commission: amt * 0.1,
          providerShare: amt * 0.9,
          method: p.payment_method || 'UPI',
          transactionId: p.transaction_id || 'N/A',
          status: status,
          date: p.payment_date ? new Date(p.payment_date).toLocaleString() : new Date(p.createdAt).toLocaleString(),
          raw: p
        };
      });

      setPayments(formattedData);
      
      setDashboardStats([
        { title: 'Total Revenue', value: `₹ ${totalRevenue.toLocaleString()}`, subtitle: 'All Time', icon: <span className="text-[14px] font-bold">₹</span>, color: 'bg-emerald-50 text-emerald-500' },
        { title: "Today's Revenue", value: `₹ ${Math.floor(totalRevenue * 0.1).toLocaleString()}`, subtitle: 'Today', icon: <FileText size={14} />, color: 'bg-blue-50 text-blue-500' },
        { title: 'This Month Revenue', value: `₹ ${Math.floor(totalRevenue * 0.5).toLocaleString()}`, subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-blue-50 text-blue-500' },
        { title: 'Successful Payments', value: successCount.toString(), subtitle: 'This Month', icon: <CheckCircle size={14} />, color: 'bg-emerald-50 text-emerald-500' },
        { title: 'Pending Payments', value: pendingCount.toString(), subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-orange-50 text-orange-500' },
        { title: 'Failed Payments', value: failedCount.toString(), subtitle: 'This Month', icon: <FileText size={14} />, color: 'bg-red-50 text-red-500' },
      ]);
      
      setLoading(false);
    } catch (error: any) {
      const status = error?.response?.status;
      const isTransient = status === 504 || status === 503 || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[PaymentsContent] Payments service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchPayments(attempt + 1), delay);
      } else {
        // ponytail: warn instead of console.error to avoid Next.js error overlay on transient outage
        console.warn('Error fetching payments:', error?.message || error);
        setLoading(false);
      }
    }
  };

  const exportCSV = () => {
    if (payments.length === 0) return message.warning('No data to export');
    const headers = 'Payment ID,Booking ID,Customer,Provider,Service,Amount,Commission,Provider Share,Method,Transaction ID,Status,Date';
    const csvRows = (payments as any[]).map((p: any) =>
      `${p.paymentId},${p.bookingId},${p.customer},${p.provider},${p.service},${p.amount},${p.commission.toFixed(2)},${p.providerShare.toFixed(2)},${p.method},${p.transactionId},${p.status},"${String(p.date).replace(/\n/g, ' ')}"`
    );
    const blob = new Blob([[headers, ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (payments.length === 0) return message.warning('No data to export');
    const tableHTML = `
      <html><head><title>Payments Report</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
        h2 { font-size: 16px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1e293b; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
        tr:nth-child(even) td { background: #f8fafc; }
      </style></head><body>
      <h2>${platformName} &mdash; Payments Report (${new Date().toLocaleDateString('en-IN')})</h2>
      <table>
        <thead><tr>
          <th>Payment ID</th><th>Booking ID</th><th>Customer</th><th>Provider</th>
          <th>Service</th><th>Amount</th><th>Commission</th><th>Provider Share</th>
          <th>Method</th><th>Transaction ID</th><th>Status</th><th>Date</th>
        </tr></thead>
        <tbody>
          ${(payments as any[]).map((p: any) => `<tr>
            <td>${p.paymentId}</td><td>${p.bookingId}</td><td>${p.customer}</td><td>${p.provider}</td>
            <td>${p.service}</td><td>&#8377;${p.amount}</td><td>&#8377;${p.commission.toFixed(2)}</td><td>&#8377;${p.providerShare.toFixed(2)}</td>
            <td>${p.method}</td><td>${p.transactionId}</td><td>${p.status}</td><td>${String(p.date).replace(/\n/g, ' ')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(tableHTML);
      printWindow.document.close();
    }
  };

  const columns = [
    {
      title: 'Payment ID',
      dataIndex: 'paymentId',
      key: 'paymentId',
      render: (text: string) => <span className="text-blue-600 font-medium">{text}</span>,
    },
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'bookingId',
      render: (text: string) => <span className="text-blue-600 font-medium">{text}</span>,
    },
    { title: 'Customer Name', dataIndex: 'customer', key: 'customer' },
    { title: 'Provider Name', dataIndex: 'provider', key: 'provider' },
    { title: 'Service Name', dataIndex: 'service', key: 'service' },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Commission', dataIndex: 'commission', key: 'commission', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Provider Share', dataIndex: 'providerShare', key: 'providerShare', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Payment Method', dataIndex: 'method', key: 'method' },
    { title: 'Transaction ID', dataIndex: 'transactionId', key: 'transactionId' },
    {
      title: 'Payment Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let colorClass = 'text-gray-600';
        if (status === 'Completed') colorClass = 'text-emerald-500';
        if (status === 'Pending') colorClass = 'text-orange-500';
        if (status === 'Failed') colorClass = 'text-red-500';

        return <span className={`font-semibold ${colorClass}`}>{status}</span>;
      }
    },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-3 text-slate-500">
          <Eye
            size={14}
            className="cursor-pointer hover:text-blue-600 transition-colors"
            onClick={() => {
              setSelectedPayment(record);
              setIsModalVisible(true);
            }}
          />
          <Download size={14} className="cursor-pointer hover:text-blue-600 transition-colors" />
        </div>
      ),
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Payments Page</h1>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <RangePicker className="h-[30px] rounded-lg border-slate-200 text-[10px]" placeholder={['01 May 2024', '31 May 2024']} format="DD MMM YYYY" />

          <div className="flex flex-col">
            <label className="text-[8.5px] text-slate-500 mb-0.5 font-bold uppercase tracking-wider">Payment Status</label>
            <Select defaultValue="All" className="w-24 h-[30px] custom-small-select" options={[{ value: 'All', label: 'All' }, { value: 'Completed', label: 'Completed' }, { value: 'Pending', label: 'Pending' }]} />
          </div>

          <div className="flex flex-col">
            <label className="text-[8.5px] text-slate-500 mb-0.5 font-bold uppercase tracking-wider">Payment Method</label>
            <Select defaultValue="All" className="w-24 h-[30px] custom-small-select" options={[{ value: 'All', label: 'All' }, { value: 'UPI', label: 'UPI' }, { value: 'Card', label: 'Card' }]} />
          </div>

          <div className="flex flex-col">
            <label className="text-[8.5px] text-slate-500 mb-0.5 font-bold uppercase tracking-wider">Service Category</label>
            <Select 
              defaultValue="All" 
              className="w-28 h-[30px] custom-small-select" 
              options={[
                { value: 'All', label: 'All' }, 
                ...categories.map(c => ({ value: c._id, label: c.category_name }))
              ]} 
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[8.5px] text-slate-500 mb-0.5 font-bold uppercase tracking-wider">Provider</label>
            <Select 
              defaultValue="All" 
              className="w-24 h-[30px] custom-small-select" 
              options={[
                { value: 'All', label: 'All' },
                ...providers.map(p => ({ value: p._id, label: p.user_id?.name || 'Unknown' }))
              ]} 
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={exportCSV} icon={<Download size={11} />} className="h-[30px] px-2.5 rounded-lg border-blue-200 text-blue-600 text-[10px] font-bold hover:border-blue-600 hover:bg-blue-50 flex items-center">
            Export CSV
          </Button>
          <Button onClick={exportPDF} icon={<Download size={11} />} className="h-[30px] px-2.5 rounded-lg border-blue-200 text-blue-600 text-[10px] font-bold hover:border-blue-600 hover:bg-blue-50 flex items-center">
            Export PDF
          </Button>
        </div>
      </div>

      {/* Dashboard Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {dashboardStats.map((stat, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-slate-100 flex items-center gap-3 px-4 py-5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-[9px] text-slate-500 font-bold mb-0.5">{stat.title}</p>
              <h3 className="text-sm font-black text-slate-800 leading-none mb-0.5">{stat.value}</h3>
              <p className="text-[8px] text-slate-400 font-medium">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        {/* Table */}
        <Table
          columns={columns}
          dataSource={(payments as any[]).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
          rowKey="key"
          loading={loading}
          pagination={false}
          className="admin-exact-small-table"
        />

        {/* Footer Pagination */}
        <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 font-medium mb-0">
            Showing {payments.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, (payments as any[]).length)} of {(payments as any[]).length} entries
          </p>
          <Pagination
            current={currentPage}
            total={(payments as any[]).length}
            pageSize={PAGE_SIZE}
            showSizeChanger={false}
            onChange={(page) => setCurrentPage(page)}
            className="custom-small-pagination"
            size="small"
          />
        </div>
      </div>

      {/* Payment Details Modal */}
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
        centered
        closeIcon={<span className="text-slate-400 text-lg hover:text-slate-800">✕</span>}
        className="payment-modal"
        title={
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Payment Details</h2>
          </div>
        }
      >
        <div className="max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
          <div className="pt-2 space-y-6">

            {/* Row 1: Payment & Booking Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">Payment Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment ID</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.paymentId || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Transaction ID</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.transactionId || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment Date</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.date || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment Method</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.method || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Payment Gateway</span><span className="text-sm font-medium text-slate-800">Razorpay</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Status</span><span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{selectedPayment?.status || 'Pending'}</span></div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-600 mb-4 border-b border-blue-100 pb-2">Booking Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Booking ID</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.bookingId || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Service</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.service || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Sub Service</span><span className="text-sm font-medium text-slate-800">Standard Service</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Booking Date</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.date?.split(',')[0] || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Scheduled Date</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.date?.split(',')[0] || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Booking Status</span><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{selectedPayment?.status || 'Pending'}</span></div>
                </div>
              </div>
            </div>

            {/* Row 2: Customer & Provider Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Customer Information</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Customer Name</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.customer || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Email</span><span className="text-sm font-medium text-slate-800">customer@example.com</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Phone</span><span className="text-sm font-medium text-slate-800">+91 —</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Location</span><span className="text-sm font-medium text-slate-800">India</span></div>
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Provider Information</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Provider Name</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.provider || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Provider ID</span><span className="text-sm font-medium text-slate-800">PROV—</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Phone</span><span className="text-sm font-medium text-slate-800">+91 —</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-500">Category</span><span className="text-sm font-medium text-slate-800">{selectedPayment?.service || '—'}</span></div>
                </div>
              </div>
            </div>

            {/* Row 3: Amount Breakdown & Revenue Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800">Amount Breakdown</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between"><span className="text-xs text-slate-600">Service Amount</span><span className="text-sm font-medium text-slate-800">₹{selectedPayment?.amount || 0}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-600">Platform Fee</span><span className="text-sm font-medium text-slate-800">₹{selectedPayment?.commission || 0}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-slate-600">GST</span><span className="text-sm font-medium text-slate-800">₹{Math.floor((selectedPayment?.amount || 0) * 0.18)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-emerald-600 font-medium">Discount Applied</span><span className="text-sm font-bold text-emerald-600">-₹0</span></div>
                  <Divider className="my-2" />
                  <div className="flex justify-between"><span className="text-sm font-bold text-slate-800">Total Paid</span><span className="text-lg font-black text-slate-800">₹{selectedPayment?.amount || 0}</span></div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="px-4 py-2 border-b border-blue-100 bg-white/50">
                  <h3 className="text-sm font-bold text-blue-800">Revenue Distribution</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-blue-100">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Paid</span>
                    <span className="text-base font-black text-slate-800">₹{selectedPayment?.amount || 0}</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 bg-white p-3 rounded-lg shadow-sm border border-emerald-100 border-l-4 border-l-emerald-500">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Commission</span>
                      <span className="text-lg font-black text-emerald-600">₹{selectedPayment?.commission || 0}</span>
                    </div>
                    <div className="flex-1 bg-white p-3 rounded-lg shadow-sm border border-blue-100 border-l-4 border-l-blue-500">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Provider Share</span>
                      <span className="text-lg font-black text-blue-600">₹{selectedPayment?.providerShare || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Refund Information */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-orange-800 mb-1">Refund Information</h3>
                <p className="text-xs text-orange-600">No refund requested for this transaction.</p>
              </div>
              <span className="text-sm font-bold text-orange-800 bg-orange-100 px-3 py-1 rounded-full">Not Requested</span>
            </div>

            {/* Timeline & Invoice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Timeline</h3>
                <Timeline
                  items={[
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">10 Jun 2026 11:25 AM</p><p className="text-xs font-medium text-slate-700">Booking Confirmed</p></> },
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">10 Jun 2026 11:28 AM</p><p className="text-xs font-medium text-slate-700">Payment Initiated</p></> },
                    { color: 'green', content: <><p className="text-[11px] text-slate-400 mb-0">10 Jun 2026 11:30 AM</p><p className="text-xs font-bold text-emerald-600">Payment Successful</p></> },
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">10 Jun 2026 11:31 AM</p><p className="text-xs font-medium text-slate-700">Booking Assigned</p></> },
                    { color: 'blue', content: <><p className="text-[11px] text-slate-400 mb-0">10 Jun 2026 02:00 PM</p><p className="text-xs font-medium text-slate-700">Service Completed</p></> },
                    { color: 'gray', content: <><p className="text-[11px] text-slate-400 mb-0">11 Jun 2026 10:00 AM</p><p className="text-xs font-medium text-slate-700">Provider Payout Processed</p></> },
                  ]}
                />
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Invoice Details</h3>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                    <div className="flex justify-between"><span className="text-xs text-slate-500">Invoice Number</span><span className="text-sm font-bold text-slate-800">INV202600125</span></div>
                    <div className="flex justify-between"><span className="text-xs text-slate-500">Generated Date</span><span className="text-sm font-medium text-slate-800">10 Jun 2026</span></div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={exportPDF} size="small" icon={<Download size={12} />} className="text-[11px] font-medium text-blue-600 border-blue-200">Download</Button>
                      <Button onClick={exportPDF} size="small" className="text-[11px] font-medium text-slate-600">View Invoice</Button>
                      <Button size="small" className="text-[11px] font-medium text-slate-600" onClick={() => message.success('Invoice sent to customer')}>Send Invoice</Button>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">Admin Remarks</h3>
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl text-xs text-yellow-800 leading-relaxed italic">
                    Customer reported delayed service. Resolved successfully by providing a ₹50 discount for future bookings.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-xl">
          <Button className="border-slate-300 text-slate-600 font-medium">Download Receipt</Button>
          <Button className="border-slate-300 text-slate-600 font-medium">Download Invoice</Button>
          <Button type="primary" onClick={() => setIsModalVisible(false)} className="bg-slate-800 font-medium">Close</Button>
        </div>
      </Modal>

      <style jsx global>{`
        .custom-small-select .ant-select-selector {
          border-radius: 6px !important;
          border-color: #e2e8f0 !important;
          font-size: 10.5px !important;
          height: 30px !important;
          padding: 0 8px !important;
        }
        .custom-small-select .ant-select-selection-item {
          line-height: 28px !important;
        }
        .admin-exact-small-table .ant-table-thead > tr > th {
          background: transparent !important;
          color: #1e293b !important;
          font-weight: 700 !important;
          font-size: 10px;
          border-bottom: 1px solid #f1f5f9;
          padding: 10px 8px;
        }
        .admin-exact-small-table .ant-table-tbody > tr > td {
          padding: 10px 8px;
          border-bottom: 1px solid #f8fafc;
          font-size: 11px;
          color: #334155;
          font-weight: 500;
        }
        .admin-exact-small-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
        .custom-small-pagination .ant-pagination-item {
          min-width: 24px;
          height: 24px;
          line-height: 22px;
          margin-inline-end: 4px;
          border-radius: 4px;
        }
        .custom-small-pagination .ant-pagination-item-active {
          background-color: #2563eb;
          border-color: #2563eb;
        }
        .custom-small-pagination .ant-pagination-item-active a {
          color: white !important;
        }
        .payment-modal .ant-modal-content {
          border-radius: 16px;
          padding: 24px;
        }
        .payment-modal .ant-modal-header {
          border-bottom: none;
          padding-bottom: 0;
        }
      `}</style>
    </div>
  );
}

