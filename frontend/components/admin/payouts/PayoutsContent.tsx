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
  const [totalRows, setTotalRows] = useState(0);
  const [statusFilter, setStatusFilter] = useState('All');
  const [providerFilter, setProviderFilter] = useState('All Providers');
  const { platformName } = useSettings();
  const PAGE_SIZE = 6;

  const [dashboardStats, setDashboardStats] = useState([
    { title: 'Total Payout Amount', value: '₹ 0', subtitle: 'All Time', icon: '₹', color: 'bg-blue-100 text-blue-600' },
    { title: 'Pending Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: '₹', color: 'bg-orange-100 text-orange-600' },
    { title: 'Completed Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: <Check size={18} />, color: 'bg-emerald-100 text-emerald-600' },
    { title: 'Failed Payouts', value: '₹ 0', subtitle: '0 Payouts', icon: <XCircle size={18} />, color: 'bg-red-100 text-red-600' },
  ]);

  useEffect(() => {
    // Handle stuck redirect query parameters from dashboard
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      if (filterParam) setStatusFilter(filterParam);
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
    fetchProviders();
  }, [currentPage, statusFilter, providerFilter]);

  const fetchProviders = async (attempt = 1) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken') || localStorage.getItem('jwt');
      const res = await axios.get(`${API_URL}/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const provData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setProviders(provData);
    } catch (err: any) {
      const status = err?.response?.status;
      const isTransient = status === 504 || status === 503 || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[PayoutsContent] Providers service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchProviders(attempt + 1), delay);
      } else {
        console.warn('Error fetching providers:', err?.message || err);
      }
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
      <script>window.onload=function(){window.print();}</script>
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

  const fetchPayouts = async (attempt = 1) => {
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
      if (providerFilter !== 'All Providers') {
        params.provider_id = providerFilter;
      }

      const response = await axios.get(`${API_URL}/payouts`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let totalAmount = 0;
      let pendingAmount = 0;
      let pendingCount = 0;
      let completedAmount = 0;
      let completedCount = 0;
      let failedAmount = 0;
      let failedCount = 0;

      const rawPayouts = response.data?.data || [];
      const total = response.data?.total || 0;
      setTotalRows(total);

      const mappedData = rawPayouts.map((p: any) => {
        const amt = p.amount || 0;
        const status = p.status === 'pending' ? 'Pending' : p.status === 'processing' ? 'Processing' : p.status === 'failed' ? 'Failed' : p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'Completed';
        
        totalAmount += amt;
        
        if (status === 'Completed' || p.status === 'paid') {
          completedAmount += amt;
          completedCount++;
        } else if (status === 'Pending' || status === 'Processing' || status === 'Approved') {
          pendingAmount += amt;
          pendingCount++;
        } else if (status === 'Failed') {
          failedAmount += amt;
          failedCount++;
        }

        return {
          key: p._id,
          payoutId: p.payoutId || p._id.substring(0, 8).toUpperCase(),
          provider: p.provider_id?.user_id?.name || p.provider_name || 'Unknown',
          bookingId: p.booking_id?.booking_id || p.booking_id || '—',
          service: p.booking_id?.subservice_id?.name || p.service || '—',
          customerPaid: p.booking_id?.payable_amount || p.customerPaid || 0,
          commission: p.booking_id?.commission_amount || p.commission || 0,
          providerAmount: amt,
          method: p.payment_method === 'bank_transfer' ? 'Bank Transfer' : p.payment_method?.toUpperCase() || 'Bank Transfer',
          refNumber: p.refNumber || p.transaction_id || '—',
          status: status,
          date: p.processedAt ? new Date(p.processedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--',
          raw: p
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
    } catch (error: any) {
      const status = error?.response?.status;
      const isTransient = status === 504 || status === 503 || error?.code === 'ECONNABORTED' || error?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[PayoutsContent] Payouts service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchPayouts(attempt + 1), delay);
      } else {
        // ponytail: warn instead of console.error to avoid Next.js error overlay on transient outage
        console.warn('Error fetching payouts:', error?.message || error);
        setLoading(false);
      }
    }
  };

  const handleUpdatePayoutStatus = async (id: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/payouts/${id}/status`, {
        status: newStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      message.success(`Payout transitioned to ${newStatus} successfully`);
      setIsModalVisible(false);
      fetchPayouts();
    } catch (error: any) {
      console.error('Error updating payout status:', error);
      message.error(error.response?.data?.message || 'Failed to update status');
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
        if (status === 'Completed' || status === 'Paid') colorClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200';
        if (status === 'Pending') colorClass = 'bg-orange-50 text-orange-500 border border-orange-200';
        if (status === 'Approved') colorClass = 'bg-indigo-50 text-indigo-500 border border-indigo-200';
        if (status === 'Processing') colorClass = 'bg-blue-50 text-blue-500 border border-blue-200';
        if (status === 'Failed' || status === 'Rejected') colorClass = 'bg-red-50 text-red-500 border border-red-200';

        return <span className={`px-3 py-1 rounded-full text-xs font-medium ${colorClass}`}>{status}</span>;
      }
    },
    { title: 'Payout Date', dataIndex: 'date', key: 'date' },
    {
      title: 'Action',
      key: 'actions',
      render: (_: any, record: any) => {
        const rawStatus = record.raw?.status;
        return (
          <div className="flex items-center gap-2 text-slate-400">
            <span title="View Details">
              <Eye
                size={16}
                className="cursor-pointer hover:text-blue-600"
                onClick={() => { setSelectedPayout(record); setIsModalVisible(true); }}
              />
            </span>
            {rawStatus === 'pending' && (
              <span title="Approve Payout">
                <Check 
                  size={16} 
                  className="cursor-pointer text-emerald-500 hover:text-emerald-700" 
                  onClick={() => handleUpdatePayoutStatus(record.key, 'approved')}
                />
              </span>
            )}
            {rawStatus === 'approved' && (
              <span title="Process Payout">
                <Check 
                  size={16} 
                  className="cursor-pointer text-blue-500 hover:text-blue-700" 
                  onClick={() => handleUpdatePayoutStatus(record.key, 'processing')}
                />
              </span>
            )}
            {rawStatus === 'processing' && (
              <span title="Mark Paid">
                <Check 
                  size={16} 
                  className="cursor-pointer text-emerald-500 hover:text-emerald-700" 
                  onClick={() => handleUpdatePayoutStatus(record.key, 'paid')}
                />
              </span>
            )}
            {rawStatus === 'processing' && (
              <span title="Mark Failed">
                <XCircle 
                  size={16} 
                  className="cursor-pointer text-red-500 hover:text-red-700" 
                  onClick={() => handleUpdatePayoutStatus(record.key, 'failed')}
                />
              </span>
            )}
            {(rawStatus === 'pending' || rawStatus === 'approved') && (
              <span title="Reject Payout">
                <XCircle 
                  size={16} 
                  className="cursor-pointer text-red-500 hover:text-red-700" 
                  onClick={() => handleUpdatePayoutStatus(record.key, 'rejected')}
                />
              </span>
            )}
          </div>
        );
      },
    }
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-3">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-0.5">Payouts Page</h1>
      </div>

      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Provider</label>
            <Select
              value={providerFilter}
              onChange={(val) => setProviderFilter(val)}
              className="w-44 h-10 custom-select"
              options={[
                { value: 'All Providers', label: 'All Providers' },
                ...providers.map(p => ({ value: p._id, label: p.user_id?.name || 'Unknown' }))
              ]}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[11px] text-slate-500 mb-1 font-medium">Status</label>
            <Select
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              className="w-32 h-10 custom-select"
              options={[
                { value: 'All', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'processing', label: 'Processing' },
                { value: 'paid', label: 'Paid' },
                { value: 'failed', label: 'Failed' },
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
        <Table
          columns={columns}
          dataSource={payouts}
          rowKey="key"
          loading={loading}
          pagination={false}
          className="admin-exact-table"
        />

        {/* Footer Pagination */}
        <div className="flex justify-between items-center mt-4 mb-8 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-0">
            Showing {payouts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, totalRows)} of {totalRows} entries
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

      {/* Modal View Details */}
      <Modal
        title="Settlement Details"
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={750}
      >
        {selectedPayout && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Bank Account Details</h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="space-y-2.5">
                    {[
                      ['Bank Name', 'HDFC Bank'],
                      ['Account Holder', selectedPayout.provider],
                      ['Account Number', 'XXXXXXXX4589'],
                      ['IFSC Code', 'HDFC0001234'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">{label}</span>
                        <span className="text-sm font-medium text-slate-800 font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">Payout Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Payout ID</span>
                    <span className="font-bold text-gray-800">{selectedPayout.payoutId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className="font-bold text-blue-600 uppercase">{selectedPayout.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer Paid</span>
                    <span className="font-bold text-gray-800">₹{selectedPayout.customerPaid}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm pt-2 border-t border-gray-100">
                    <span className="text-gray-800">Partner Earnings</span>
                    <span className="text-green-600">₹{selectedPayout.providerAmount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status-aware Footer Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
              {selectedPayout.raw?.status === 'pending' && (
                <>
                  <Button danger className="font-medium" onClick={() => handleUpdatePayoutStatus(selectedPayout.key, 'rejected')}>Reject Payout</Button>
                  <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => handleUpdatePayoutStatus(selectedPayout.key, 'approved')}>Approve Payout</Button>
                </>
              )}
              {selectedPayout.raw?.status === 'approved' && (
                <>
                  <Button type="primary" className="bg-blue-600 hover:bg-blue-700 font-medium border-none" onClick={() => handleUpdatePayoutStatus(selectedPayout.key, 'processing')}>Process Payout</Button>
                </>
              )}
              {selectedPayout.raw?.status === 'processing' && (
                <>
                  <Button danger className="font-medium" onClick={() => handleUpdatePayoutStatus(selectedPayout.key, 'failed')}>Mark Failed</Button>
                  <Button type="primary" className="bg-emerald-600 hover:bg-emerald-700 font-medium border-none" onClick={() => handleUpdatePayoutStatus(selectedPayout.key, 'paid')}>Mark Paid</Button>
                </>
              )}
              <Button className="border-slate-300 text-slate-600 font-medium" onClick={() => setIsModalVisible(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}