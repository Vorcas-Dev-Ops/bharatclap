"use client";

import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Card, Button, message } from 'antd';
import { Download, CreditCard } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import moment from 'moment';

const { Title } = Typography;

export default function PaymentsContent() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // The API returns either the payments array or { data: [...] }
      const data = response.data.data || response.data;
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      message.error('Failed to load payments from database');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'transaction_id',
      key: 'transaction_id',
      render: (text: string) => <span className="font-mono text-xs">{text || 'N/A'}</span>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => <span className="font-bold">₹{amount?.toFixed(2) || '0.00'}</span>,
    },
    {
      title: 'Method',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (method: string) => <span className="uppercase font-bold text-[10px] tracking-wider text-slate-500">{method}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'completed') color = 'success';
        if (status === 'pending') color = 'warning';
        if (status === 'failed') color = 'error';
        if (status === 'refunded') color = 'magenta';
        return <Tag color={color} className="uppercase font-bold text-[10px] tracking-wider border-none px-2 py-0.5 rounded-md">{status}</Tag>;
      }
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => <span className="text-sm text-slate-600">{moment(date).format('DD MMM YYYY, hh:mm A')}</span>,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <CreditCard size={24} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-slate-800 !font-black tracking-tight">Payments Database</Title>
            <p className="text-slate-500 mt-1 text-sm font-medium">Live data fetched from the Payments microservice.</p>
          </div>
        </div>
        <Button type="primary" icon={<Download size={16} />} className="bg-[#1D2B83] border-none h-10 px-6 font-bold tracking-wide rounded-xl">
          Export CSV
        </Button>
      </div>

      <Card className="shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={payments} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10, className: "px-6" }}
          className="admin-table"
        />
      </Card>
    </div>
  );
}
