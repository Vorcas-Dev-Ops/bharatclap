"use client";

import React, { useState, useEffect } from 'react';
import { Table, Typography, Button, Select, DatePicker, message, Pagination, Modal, Divider, Timeline } from 'antd';
import { Download, Eye, CheckCircle, XCircle, ChevronRight, Check } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';
import { API_URL } from '@/config/api';
import { useSettings } from '@/context/SettingsContext';

const { RangePicker } = DatePicker;

export default function PayoutsContent() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const { platformName } = useSettings();
  const PAGE_SIZE = 10;

  const [dashboardStats, setDashboardStats] = useState([
    { title: 'Total Payout Amount', value: '₹ 0', subtitle: 'All Time', icon: '₹', color: 'bg-blue-100 text-blue-600' },
    { title: 'Pending Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: '₹', color: 'bg-orange-100 text-orange-600' },
    { title: 'Completed Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600' },
    { title: 'Failed Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: <XCircle size={18} />, color: 'bg-red-100 text-red-600' },
  ]);

  useEffect(() => {
    fetchPayouts();
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviders(res.data || []);
    } catch (err) {
      console.error('Error fetching providers:', err);
    }
  };

  const exportCSV = () => {
    if (payouts.length === 0) return message.warning('No data to export');
    const headers = 'Payout ID,Provider Name,Booking ID,Service,Customer Paid,Commission Deducted,Provider Amount,Payout Method,Reference Number,Status,Payout Date';
    const csvRows = (payouts as any[]).map((p: any) =>
      `${p.payoutId},${p.provider},${p.bookingId},"${p.service}",${p.customerPaid},${p.commission},${p.providerAmount},${p.method},${p.refNumber},${p.status},${p.date}`
    );
    const blob = new Blob([[headers, ...csvRows].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadPayoutReceipt = () => {
    const p = selectedPayout;
    if (!p) return;
    const html = `
      <html><head><title>Payout Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #1e293b; }
        h2 { font-size: 18px; margin-bottom: 4px; } .subtitle { color: #64748b; margin-bottom: 20px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #1e293b; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) td { background: #f8fafc; }
        .total td { font-weight: bold; background: #f0fdf4; color: #166534; }
        .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; background: #d1fae5; color: #065f46; font-weight: bold; }
      </style></head><body>
      <h2>${platformName} — Payout Receipt</h2>
      <div class="subtitle">Generated on ${new Date().toLocaleString('en-IN')}</div>
      <table>
        <tr><th>Field</th><th>Details</th></tr>
        <tr><td>Payout ID</td><td>${p.payoutId}</td></tr>
        <tr><td>Provider Name</td><td>${p.provider}</td></tr>
        <tr><td>Booking ID</td><td>${p.bookingId}</td></tr>
        <tr><td>Service</td><td>${p.service}</td></tr>
        <tr><td>Payout Method</td><td>${p.method}</td></tr>
        <tr><td>Reference Number</td><td>${p.refNumber}</td></tr>
        <tr><td>Payout Date</td><td>${p.date}</td></tr>
        <tr><td>Status</td><td><span class="badge">${p.status}</span></td></tr>
        <tr><td>Customer Paid</td><td>&#8377;${p.customerPaid?.toLocaleString()}</td></tr>
        <tr><td>Commission Deducted (15%)</td><td>&#8377;${p.commission?.toLocaleString()}</td></tr>
        <tr class="total"><td>Amount Transferred to Provider</td><td>&#8377;${p.providerAmount?.toLocaleString()}</td></tr>
      </table>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const downloadSettlementReport = () => {
    const p = selectedPayout;
    if (!p) return;
    const headers = 'Payout ID,Provider,Booking ID,Service,Customer Paid,Commission,Provider Amount,Method,Reference,Status,Date';
    const row = `${p.payoutId},${p.provider},${p.bookingId},"${p.service}",${p.customerPaid},${p.commission},${p.providerAmount},${p.method},${p.refNumber},${p.status},${p.date}`;
    const blob = new Blob([[headers, row].join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlement_${p.payoutId}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/payouts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let totalAmount = 0;
      let pendingAmount = 0;
      let pendingCount = 0;
      let completedAmount = 0;
      let completedCount = 0;
      let failedAmount = 0;
      let failedCount = 0;

      const mappedData = response.data.data.map((p: any) => {
        const amt = p.amount || 0;
        const status = p.status === 'pending' ? 'Pending' : p.status === 'processing' ? 'Processing' : p.status === 'failed' ? 'Failed' : 'Completed';
        
        totalAmount += amt;
        
        if (status === 'Completed') {
          completedAmount += amt;
          completedCount++;
        } else if (status === 'Pending' || status === 'Processing') {
          pendingAmount += amt;
          pendingCount++;
        } else if (status === 'Failed') {
          failedAmount += amt;
          failedCount++;
        }

        return {
          key: p._id,
          payoutId: p.payoutId || p._id.substring(0, 8).toUpperCase(),
          provider: p.provider_name || 'Unknown',
          bookingId: p.bookingId || '—',
          service: p.service || '—',
          customerPaid: p.customerPaid || 0,
          commission: p.commission || 0,
          providerAmount: amt,
          method: p.payment_method === 'bank_transfer' ? 'Bank Transfer' : p.payment_method?.toUpperCase() || 'Bank Transfer',
          refNumber: p.refNumber || p.transaction_id || '—',
          status: status,
          date: p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--',
          raw: p // keep original data
        };
      });
      
      setPayouts(mappedData);
      setDashboardStats([
        { title: 'Total Payout Amount', value: `₹ ${totalAmount.toLocaleString()}`, subtitle: 'All Time', icon: '₹', color: 'bg-blue-100 text-blue-600' },
        { title: 'Pending Payouts', value: `₹ ${pendingAmount.toLocaleString()}`, subtitle: `${pendingCount} Payouts`, icon: '₹', color: 'bg-orange-100 text-orange-600' },
        { title: 'Completed Payouts', value: `₹ ${completedAmount.toLocaleString()}`, subtitle: `${completedCount} Payouts`, icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600' },
        { title: 'Failed Payouts', value: `₹ ${failedAmount.toLocaleString()}`, subtitle: `${failedCount} Payouts`, icon: <XCircle size={18} />, color: 'bg-red-100 text-red-600' },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      message.error('Failed to load payouts');
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Payout ID', dataIndex: 'payoutId', key: 'payoutId', render: (text: string) => <span className="text-blue-600 font-medium">{text}</span> },
    { title: 'Provider Name', dataIndex: 'provider', key: 'provider' },
    { title: 'Booking ID', dataIndex: 'bookingId', key: 'bookingId', render: (text: string) => <span className="text-blue-600 font-medium">{text}</span> },
    { title: 'Service Name', dataIndex: 'service', key: 'service' },
    { title: 'Customer Paid', dataIndex: 'customerPaid', key: 'customerPaid', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Commission Deducted', dataIndex: 'commission', key: 'commission', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Provider Amount', dataIndex: 'providerAmount', key: 'providerAmount', render: (val: number) => `₹${val.toLocaleString()}` },
    { title: 'Payout Method', dataIndex: 'method', key: 'method' },
    { title: 'Reference Number', dataIndex: 'refNumber', key: 'refNumber' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let colorClass = 'bg-gray-100 text-gray-600';
        if (status === 'Completed') colorClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
        if (status === 'Pending') colorClass = 'bg-orange-50 text-orange-500 border border-orange-200';
        if (status === 'Processing') colorClass = 'bg-blue-50 text-blue-500 border border-blue-200';

        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}>{status}</span>;
      }
    },
    { title: 'Payout Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => (
        <div className="flex items-center gap-2 text-slate-400">
          <Eye
            size={16}
            className="cursor-pointer hover:text-blue-600"
            onClick={() => { setSelectedPayout(record); setIsModalVisible(true); }}
          />
          <Check size={16} className="cursor-pointer text-emerald-500 hover:text-emerald-700" />
          <XCircle size={16} className="cursor-pointer text-red-500 hover:text-red-700" />
        </div>
      ),
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Payouts Page</h1>
      </div>
      {/* Filters Row — below header, above cards */}

      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Provider</label>
            <Select
              defaultValue="All Providers"
              className="w-44 h-10 custom-select"
              options={[
                { value: 'All Providers', label: 'All Providers' },
                ...providers.map(p => ({ value: p._id, label: p.user_id?.name || 'Unknown' }))
              ]}
            />
          </div>

          <RangePicker className="h-10 rounded-lg border-slate-200" placeholder={['01 May 2024', '31 May 2024']} format="DD MMM YYYY" />

          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Status</label>
            <Select
              defaultValue="All"
              className="w-32 h-10 custom-select"
              options={[
                { value: 'All', label: 'All' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Processing', label: 'Processing' },
              ]}
            />
          </div>
        </div>

        <Button onClick={exportCSV} icon={<Download size={16} />} className="h-10 px-4 rounded-lg border-blue-200 text-blue-600 font-medium hover:border-blue-600 hover:bg-blue-50">
          Export Report
        </Button>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          dataSource={(payouts as any[]).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
          rowKey="key"
          loading={loading}
          pagination={false}
          className="admin-exact-table"
        />

        {/* Footer Pagination */}
        <div className="flex justify-between items-center mt-4 mb-8 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-0">
            Showing {payouts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, (payouts as any[]).length)} of {(payouts as any[]).length} entries
          </p>
          <Pagination
            current={currentPage}
            total={(payouts as any[]).length}
            pageSize={PAGE_SIZE}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
            className="custom-pagination"
          />
        </div>

      </div>

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
      `}</style>

      {/* Payout Details Modal */}
      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={1000}
        centered
        title={
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide m-0">Payout Details</h2>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6 pt-2">

          {/* Row 1: Payout Info & Provider Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-blue-600 mb-3 border-b border-blue-100 pb-2">Payout Information</h3>
              <div className="space-y-2.5">
                {[
                  ['Payout ID', selectedPayout?.payoutId || 'PO202600123'],
                  ['Payout Date', selectedPayout?.date || '15 Jun 2026'],
                  ['Payout Method', selectedPayout?.method || 'Bank Transfer'],
                  ['Reference Number', selectedPayout?.refNumber || 'UTR784512369'],
                  ['Processed By', 'Super Admin'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Status</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${selectedPayout?.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                      selectedPayout?.status === 'Pending' ? 'bg-orange-50 text-orange-500' :
                        'bg-blue-50 text-blue-500'
                    }`}>{selectedPayout?.status || 'Completed'}</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-800">Provider Information</h3>
              </div>
              <div className="space-y-2.5">
                {[
                  ['Provider Name', selectedPayout?.provider || 'Arun Services'],
                  ['Provider ID', 'PROV1025'],
                  ['Phone Number', '+91 9876543210'],
                  ['Email', 'arunservices@gmail.com'],
                  ['Category', selectedPayout?.service || 'AC Repair Services'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Booking Info & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800">Booking Information</h3>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  ['Booking ID', selectedPayout?.bookingId || 'BK202600789'],
                  ['Service', 'AC Repair'],
                  ['Sub-Service', 'Gas Refilling'],
                  ['Booking Date', '14 Jun 2026'],
                  ['Completed Date', '15 Jun 2026'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">Booking Status</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Completed</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Customer Information</h3>
              <div className="space-y-2.5">
                {[
                  ['Customer Name', 'Swathi P'],
                  ['Phone', '+91 9876541230'],
                  ['Location', 'KR Puram, Bangalore'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-sm font-medium text-slate-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Financial Breakdowns — 3 columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Payment Breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Payment Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Customer Paid</span><span className="font-medium text-slate-800">₹{selectedPayout?.customerPaid?.toLocaleString() || '1,200'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Discount Applied</span><span className="font-medium text-slate-800">₹100</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">GST</span><span className="font-medium text-slate-800">₹18</span></div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-xs"><span className="font-bold text-slate-800">Net Amount Received</span><span className="font-bold text-slate-800">₹1,118</span></div>
              </div>
            </div>

            {/* Commission Breakdown */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 mb-3 pb-2 border-b border-slate-100">Commission Breakdown</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs"><span className="text-slate-500">Platform Commission</span><span className="font-medium text-slate-800">₹{selectedPayout?.commission?.toLocaleString() || '168'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-slate-500">Commission Rate</span><span className="font-medium text-slate-800">15%</span></div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-xs"><span className="font-bold text-slate-800">Provider Earnings</span><span className="font-bold text-slate-800">₹{selectedPayout?.providerAmount?.toLocaleString() || '950'}</span></div>
              </div>
            </div>

            {/* Payout Breakdown + visual flow */}
            <div className="border border-blue-100 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-white shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 mb-3 pb-2 border-b border-blue-100">Payout Flow</h3>
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 w-full">
                  <p className="text-[10px] text-slate-500 m-0">Customer Paid</p>
                  <p className="text-sm font-black text-slate-800 m-0">₹{selectedPayout?.customerPaid?.toLocaleString() || '1,118'}</p>
                </div>
                <span className="text-slate-400 text-base">↓</span>
                <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-1.5 w-full">
                  <p className="text-[10px] text-orange-500 m-0">{platformName} Commission</p>
                  <p className="text-[15px] font-bold text-slate-800 m-0">₹{selectedPayout?.commission?.toLocaleString()}</p>
                </div>
                <span className="text-slate-400 text-base">↓</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check size={16} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 font-bold m-0 uppercase">{platformName} Transferred</p>
                    <p className="text-sm font-black text-emerald-700 m-0">₹{selectedPayout?.providerAmount?.toLocaleString() || '950'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bank Details & Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Bank Account Details</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-2.5">
                  {[
                    ['Bank Name', 'HDFC Bank'],
                    ['Account Holder', 'Arun Services'],
                    ['Account Number', 'XXXXXXXX4589'],
                    ['IFSC Code', 'HDFC0001234'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-sm font-medium text-slate-800 font-mono">{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 italic text-center border-t border-slate-200 pt-2">Only last 4 digits visible for security</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Payout Timeline</h3>
              <Timeline
                items={[
                  { color: 'gray', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 10:00 AM</p><p className="text-xs font-medium text-slate-700 mb-0">Service Completed</p></> },
                  { color: 'blue', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 10:15 AM</p><p className="text-xs font-medium text-slate-700 mb-0">Provider Earnings Generated</p></> },
                  { color: 'orange', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 11:00 AM</p><p className="text-xs font-bold text-orange-600 mb-0">Payout Requested</p></> },
                  { color: 'blue', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 12:00 PM</p><p className="text-xs font-medium text-slate-700 mb-0">Approved By Admin</p></> },
                  { color: 'blue', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 01:10 PM</p><p className="text-xs font-medium text-slate-700 mb-0">Transferred To Bank</p></> },
                  { color: 'green', content: <><p className="text-[10px] text-slate-400 mb-0">15 Jun 2026 01:12 PM</p><p className="text-xs font-bold text-emerald-600 mb-0">Payout Successful</p></> },
                ]}
              />
            </div>
          </div>

          {/* Related Transactions */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Related Transactions</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600">Booking ID</th>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600">Service</th>
                    <th className="px-4 py-2 text-xs font-bold text-slate-600 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[['BK1001', 'AC Repair', '₹450'], ['BK1002', 'AC Service', '₹300'], ['BK1003', 'Gas Filling', '₹200']].map(([id, svc, amt]) => (
                    <tr key={id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-blue-600 font-medium text-xs">{id}</td>
                      <td className="px-4 py-2 text-slate-700 text-xs">{svc}</td>
                      <td className="px-4 py-2 text-slate-800 font-medium text-xs text-right">{amt}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50 border-t border-blue-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-xs font-bold text-slate-800 text-right">Total Provider Earnings</td>
                    <td className="px-4 py-2 text-sm font-black text-emerald-600 text-right">₹950</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Remarks & Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Admin Remarks</h3>
              <div className="bg-slate-50 p-3 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700 m-0">Monthly payout processed successfully.</p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Documents</h3>
              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadPayoutReceipt} icon={<Download size={13} />} className="text-xs font-medium text-blue-600 border-blue-200">Payout Receipt</Button>
                <Button onClick={downloadSettlementReport} icon={<Download size={13} />} className="text-xs font-medium text-blue-600 border-blue-200">Settlement Report</Button>
              </div>
            </div>
          </div>

        </div>

        {/* Status-aware Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end bg-slate-50 -mx-6 -mb-6 px-6 py-4 rounded-b-xl">
          {selectedPayout?.status === 'Pending' && (
            <>
              <Button className="border-orange-300 text-orange-600 font-medium">Hold Payout</Button>
              <Button danger className="font-medium">Reject Payout</Button>
              <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none">Approve Payout</Button>
            </>
          )}
          {selectedPayout?.status === 'Processing' && (
            <>
              <Button className="border-blue-300 text-blue-600 font-medium">Retry Transfer</Button>
              <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none">Mark as Completed</Button>
            </>
          )}
          {selectedPayout?.status === 'Completed' && (
            <>
              <Button onClick={downloadPayoutReceipt} icon={<Download size={13} />} className="border-blue-300 text-blue-600 font-medium">Download Receipt</Button>
            </>
          )}
          <Button className="border-slate-300 text-slate-600 font-medium" onClick={() => setIsModalVisible(false)}>Close</Button>
        </div>
      </Modal>

    </div>
  );
}