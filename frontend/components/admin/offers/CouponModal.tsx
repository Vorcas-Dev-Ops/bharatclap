"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Calendar, 
  Info, 
  Target, 
  Settings, 
  Layers, 
  Shield, 
  Gift,
  Plus,
  Trash2,
  RefreshCcw
} from 'lucide-react';
import { 
  Modal, 
  Form, 
  Input, 
  InputNumber, 
  Select, 
  DatePicker, 
  Switch, 
  Checkbox, 
  Button, 
  Space, 
  Divider, 
  message,
  Tabs,
  App
} from 'antd';
import dayjs from 'dayjs';
import axios from 'axios';
import { API_URL } from '@/config/api';

const { Option } = Select;
const { TextArea } = Input;

interface CouponModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCoupon?: any;
}

const CouponModal: React.FC<CouponModalProps> = ({ isOpen, onClose, onSuccess, editingCoupon }) => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);

  // Watch for selected categories to filter services
  const selectedCategories = Form.useWatch('allowedCategories', form);

  const filteredServices = services.filter((s: any) => {
    if (!selectedCategories || selectedCategories.length === 0) return true;
    const catId = typeof s.category_id === 'object' ? s.category_id._id : s.category_id;
    return selectedCategories.includes(catId);
  });

  useEffect(() => {
    if (isOpen) {
      fetchFormOptions();
      if (editingCoupon && editingCoupon._id) {
        form.setFieldsValue({
          ...editingCoupon,
          startDate: editingCoupon.startDate ? dayjs(editingCoupon.startDate) : dayjs(),
          expiryDate: editingCoupon.expiryDate ? dayjs(editingCoupon.expiryDate) : dayjs().add(30, 'day')
        });
      } else {
        form.resetFields();
        // Explicitly set defaults again to ensure they are captured even if tabs aren't visited
        form.setFieldsValue({
          discountType: 'flat',
          autoApply: editingCoupon?.autoApply || false,
          status: 'active',
          targetAudience: ['all'],
          startDate: dayjs(),
          expiryDate: dayjs().add(30, 'day'),
          perUserLimit: 1,
          usageLimit: 0,
          minOrderAmount: 0,
          maxDiscountLimit: 0
        });
      }
    }
  }, [isOpen, editingCoupon, form]);

  const fetchFormOptions = async () => {
    const token = localStorage.getItem('token');
    try {
      const [cats, servs, membs] = await Promise.all([
        axios.get(`${API_URL}/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/services`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/memberships`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setCategories(cats.data);
      setServices(servs.data);
      setMemberships(membs.data);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      // Validate dates manually if they somehow bypassed form validation
      const startDate = values.startDate;
      const expiryDate = values.expiryDate;

      if (!startDate || !expiryDate) {
        // Switch to the tab that has the error so the user can see it
        messageApi.warning('Please check "Discount & Limits" for missing dates');
        setLoading(false);
        return;
      }

      const payload = {
        ...values,
        startDate: dayjs(startDate).toISOString(),
        expiryDate: dayjs(expiryDate).toISOString(),
        discountValue: Number(values.discountValue || 0),
        minOrderAmount: Number(values.minOrderAmount || 0),
        maxDiscountLimit: Number(values.maxDiscountLimit || 0),
        usageLimit: Number(values.usageLimit || 0),
        perUserLimit: Number(values.perUserLimit || 1),
      };

      if (editingCoupon && editingCoupon._id) {
        await axios.put(`${API_URL}/admin/coupons/${editingCoupon._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        messageApi.success('Coupon updated successfully');
      } else {
        await axios.post(`${API_URL}/admin/coupons`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        messageApi.success('Coupon created successfully');
      }
      onSuccess();
    } catch (error: any) {
      console.error('Save Error Details:', error.response?.data || error);
      messageApi.error(error.response?.data?.message || error.message || 'Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'basic',
      label: <span className="flex items-center gap-2 px-2 py-1"><Info size={16}/> Basic Details</span>,
      children: (
        <div className="space-y-6 pt-4">
          <Form.Item
            name="name"
            label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Coupon Name</span>}
            rules={[
              { required: true, message: 'Coupon name is required' },
              { min: 3, message: 'Name must be at least 3 characters' }
            ]}
          >
            <Input placeholder="e.g. Summer Mega Sale" className="h-12 rounded-xl text-sm font-bold border-gray-100 bg-gray-50/50" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-6">
            <Form.Item
              name="code"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Coupon Code</span>}
              rules={[
                { required: true, message: 'Coupon code is required' },
                { pattern: /^[A-Z0-9]+$/, message: 'Code must be uppercase alphanumeric only' }
              ]}
            >
              <Input placeholder="e.g. SUMMER50" className="h-12 rounded-xl text-sm font-black uppercase tracking-widest border-gray-100 bg-gray-50/50" />
            </Form.Item>

            <Form.Item
              name="status"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</span>}
            >
              <Select className="h-12 rounded-xl font-bold border-gray-100 bg-gray-50/50" classNames={{ popup: { root: 'rounded-xl' } }}>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</span>}
            rules={[{ required: true, message: 'Description is required' }]}
          >
            <TextArea rows={3} placeholder="Briefly describe the offer details..." className="rounded-xl font-bold border-gray-100 bg-gray-50/50" />
          </Form.Item>

          <div className="flex flex-wrap gap-6 p-6 bg-blue-50/50 rounded-[1.5rem] border border-blue-100">
            <Form.Item name="autoApply" valuePropName="checked" noStyle>
              <div className="flex items-center gap-3">
                <Switch className="bg-gray-300" />
                <span className="text-xs font-black text-blue-900 uppercase tracking-tight">AUTO-APPLY DURING BOOKING</span>
              </div>
            </Form.Item>
            <Form.Item name="isFeatured" valuePropName="checked" noStyle>
              <div className="flex items-center gap-3">
                <Switch className="bg-gray-300" />
                <span className="text-xs font-black text-blue-900 uppercase tracking-tight">FEATURED ON DASHBOARD</span>
              </div>
            </Form.Item>
          </div>
        </div>
      )
    },
    {
      key: 'discount',
      label: <span className="flex items-center gap-2 px-2 py-1"><Target size={16}/> Discount & Limits</span>,
      children: (
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-6">
            <Form.Item
              name="discountType"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount Type</span>}
              rules={[{ required: true }]}
            >
              <Select className="h-12 rounded-xl font-bold bg-gray-50/50 border-gray-100">
                <Option value="flat">Flat Discount (₹)</Option>
                <Option value="percentage">Percentage (%)</Option>
                <Option value="cashback">Cashback (₹)</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="discountValue"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount Value</span>}
              rules={[
                { required: true, message: 'Value is required' },
                { type: 'number', min: 1, message: 'Value must be positive' }
              ]}
            >
              <InputNumber min={0} className="w-full h-12 rounded-xl font-black text-lg flex items-center bg-gray-50/50 border-gray-100" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Form.Item
              name="minOrderAmount"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min Order Amount</span>}
            >
              <InputNumber min={0} className="w-full h-12 rounded-xl font-bold flex items-center bg-gray-50/50 border-gray-100" prefix="₹" />
            </Form.Item>

            <Form.Item
              name="maxDiscountLimit"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Max Discount Limit</span>}
            >
              <InputNumber min={0} className="w-full h-12 rounded-xl font-bold flex items-center bg-gray-50/50 border-gray-100" prefix="₹" />
            </Form.Item>
          </div>

          <Divider className="my-2 border-gray-100" />

          <div className="grid grid-cols-2 gap-6">
            <Form.Item
              name="usageLimit"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Usage Limit</span>}
              extra={<span className="text-[10px] font-bold text-gray-400">0 for unlimited</span>}
            >
              <InputNumber min={0} className="w-full h-12 rounded-xl font-bold flex items-center bg-gray-50/50 border-gray-100" />
            </Form.Item>

            <Form.Item
              name="perUserLimit"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Per User Limit</span>}
            >
              <InputNumber min={1} className="w-full h-12 rounded-xl font-bold flex items-center bg-gray-50/50 border-gray-100" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Form.Item
              name="startDate"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Start Date</span>}
              rules={[{ required: true, message: 'Start date is required' }]}
            >
              <DatePicker className="w-full h-12 rounded-xl font-bold bg-gray-50/50 border-gray-100" />
            </Form.Item>

            <Form.Item
              name="expiryDate"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry Date</span>}
              rules={[
                { required: true, message: 'Expiry date is required' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('startDate') <= value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Expiry must be after start date'));
                  },
                }),
              ]}
            >
              <DatePicker className="w-full h-12 rounded-xl font-bold bg-gray-50/50 border-gray-100" />
            </Form.Item>
          </div>
        </div>
      )
    },
    {
      key: 'visibility',
      label: <span className="flex items-center gap-2 px-2 py-1"><Shield size={16}/> Audience & Visibility</span>,
      children: (
        <div className="space-y-6 pt-4">
          <Form.Item
            name="targetAudience"
            label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Target Audience</span>}
          >
            <Checkbox.Group className="grid grid-cols-3 gap-4 bg-gray-50/50 p-6 rounded-[1.5rem] border border-gray-100">
              <Checkbox value="all" className="font-bold text-gray-700 text-xs uppercase">All Users</Checkbox>
              <Checkbox value="members" className="font-bold text-gray-700 text-xs uppercase">Members Only</Checkbox>
              <Checkbox value="first_time" className="font-bold text-gray-700 text-xs uppercase">First-timers</Checkbox>
            </Checkbox.Group>
          </Form.Item>

          <div className="grid grid-cols-1 gap-6">
            <Form.Item
              name="allowedMemberships"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Restricted Memberships</span>}
            >
              <Select mode="multiple" placeholder="Select memberships..." className="rounded-xl min-h-[48px]" classNames={{ popup: { root: 'rounded-xl' } }}>
                {memberships.map((m: any) => (
                  <Option key={m._id} value={m._id}>{m.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="allowedCategories"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Restrict to Categories</span>}
            >
              <Select mode="multiple" placeholder="Select categories..." className="rounded-xl min-h-[48px]" classNames={{ popup: { root: 'rounded-xl' } }}>
                {categories.map((c: any) => (
                  <Option key={c._id} value={c._id}>{c.category_name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="allowedServices"
              label={<span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Restrict to Services</span>}
            >
              <Select mode="multiple" placeholder="Select services..." className="rounded-xl min-h-[48px]" classNames={{ popup: { root: 'rounded-xl' } }}>
                {filteredServices.map((s: any) => (
                  <Option key={s._id} value={s._id}>{s.service_name}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div className="p-6 bg-purple-50/50 rounded-[1.5rem] border border-purple-100">
            <Form.Item
              name="highlightGradient"
              label={<span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Custom Highlight Gradient</span>}
            >
              <Select className="h-10 rounded-lg" classNames={{ popup: { root: 'rounded-xl' } }}>
                <Option value="from-blue-600 to-indigo-600">Blue-Indigo</Option>
                <Option value="from-purple-600 to-pink-600">Purple-Pink</Option>
                <Option value="from-emerald-600 to-teal-600">Emerald-Teal</Option>
                <Option value="from-orange-500 to-red-600">Orange-Red</Option>
              </Select>
            </Form.Item>
          </div>
        </div>
      )
    }
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3 py-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Gift size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-none">
              {editingCoupon?._id ? 'Edit Coupon' : 'Create New Coupon'}
            </h2>
            <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-wider">
              {editingCoupon?.autoApply ? 'Auto-Applied Offer' : 'Coupon Campaign'}
            </p>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      width={680}
      centered
      footer={
        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 rounded-b-[3rem]">
          <Button 
            onClick={onClose} 
            size="large" 
            className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-14 px-10 border-2 border-gray-100 hover:border-gray-300 transition-all"
          >
            CANCEL
          </Button>
          <Button 
            type="primary" 
            size="large" 
            onClick={() => form.submit()} 
            loading={loading}
            className="rounded-2xl font-black text-[10px] uppercase tracking-widest h-14 px-12 bg-gradient-to-r from-blue-600 to-indigo-600 border-none shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {loading ? <RefreshCcw size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            {editingCoupon?._id ? 'UPDATE CAMPAIGN' : 'LAUNCH CAMPAIGN'}
          </Button>
        </div>
      }
      className="premium-modal"
      styles={{ 
        header: { padding: '32px 40px', borderBottom: '1px solid #f1f5f9', marginBottom: 0 },
        body: { padding: '0px', maxHeight: '60vh', overflowY: 'auto' }
      }}
      bodyProps={{ className: 'custom-scrollbar' }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        className="px-10 py-8"
        initialValues={{
          discountType: 'flat',
          status: 'active',
          targetAudience: ['all'],
          startDate: dayjs(),
          expiryDate: dayjs().add(30, 'day'),
          perUserLimit: 1,
          usageLimit: 0,
          minOrderAmount: 0,
          maxDiscountLimit: 0,
          autoApply: false,
          isFeatured: false,
          highlightGradient: "from-blue-600 to-indigo-600"
        }}
      >
        <Tabs 
          defaultActiveKey="basic" 
          items={tabItems} 
          className="coupon-tabs pb-4 custom-tabs"
        />
      </Form>

      <style jsx global>{`
        .premium-modal .ant-modal-content {
          border-radius: 3rem !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .custom-tabs .ant-tabs-nav::before {
          border-bottom: 1px solid #f1f5f9;
        }
        .custom-tabs .ant-tabs-tab {
          padding: 12px 0;
          margin: 0 24px 0 0;
        }
        .custom-tabs .ant-tabs-tab-btn {
          font-size: 10px;
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
    </Modal>
  );
};

export default function CouponModalWrapper(props: CouponModalProps) {
  return (
    <App>
      <CouponModal {...props} />
    </App>
  );
}
