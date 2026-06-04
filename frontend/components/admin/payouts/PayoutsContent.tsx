"use client";

import React, { useState, useEffect } from 'react';
import { Table, Tag, Typography, Card, Button, message } from 'antd';
import { Download, Wallet } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/api';
import moment from 'moment';

const { Title } = Typography;

export default function PayoutsContent() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/payouts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data.data || response.data;
      setPayouts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      message.error('Failed to load payouts from database');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Payout ID',
      dataIndex: '_id',
      key: '_id',
      render: (text: string) => <span className="font-mono text-xs text-blue-600 font-bold">{text?.substring(0, 8).toUpperCase() || 'N/A'}</span>,
    },
    {
      title: 'Provider',
      dataIndex: 'provider_id',
      key: 'provider',
      render: (provider: any) => provider ? <span className="font-medium text-slate-700">{provider.firstName} {provider.lastName}</span> : 'Unknown Provider',
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
      render: (method: string) => <span className="uppercase font-bold text-[10px] tracking-wider text-slate-500">{method?.replace('_', ' ') || 'BANK TRANSFER'}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'completed') color = 'success';
        if (status === 'processing') color = 'processing';
        if (status === 'failed') color = 'error';
        if (status === 'pending') color = 'warning';
        return <Tag color={color} className="uppercase font-bold text-[10px] tracking-wider border-none px-2 py-0.5 rounded-md">{status}</Tag>;
      }
    },
    {
      title: 'Requested On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => <span className="text-sm text-slate-600">{moment(date).format('DD MMM YYYY')}</span>,
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
            <Wallet size={24} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-slate-800 !font-black tracking-tight">Provider Payouts</Title>
            <p className="text-slate-500 mt-1 text-sm font-medium">Manage settlement requests and wallet payouts.</p>
          </div>
        </div>
        <Button type="primary" icon={<Download size={16} />} className="bg-[#1D2B83] border-none h-10 px-6 font-bold tracking-wide rounded-xl">
          Export CSV
        </Button>
      </div>

      <Card className="shadow-sm rounded-2xl border border-slate-100 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={payouts} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10, className: "px-6" }}
          className="admin-table"
        />
      </Card>
    </div>
  );
}