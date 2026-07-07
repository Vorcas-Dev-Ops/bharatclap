"use client";

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Save, Plus, Trash2, Edit, Trash } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

export default function ConfigurationTab() {
  const [messageApi, contextHolder] = message.useMessage();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kitId, setKitId] = useState<string | null>(null);

  // States
  const [name, setName] = useState('Fixvo Professional Starter Kit');
  const [description, setDescription] = useState('Complete onboarding kit for providers');
  const [status, setStatus] = useState('active');

  const [items, setItems] = useState<any[]>([
    { name: 'Fixvo Uniform T-Shirt', description: 'Professional branded uniform', stock: 500 },
    { name: 'Fixvo Carry Bag', description: 'Durable equipment bag', stock: 450 },
    { name: 'Provider ID Card', description: 'Official identification lanyard', stock: 1000 },
  ]);

  const [sizes, setSizes] = useState([
    { size: 'S', active: true, stock: 50 },
    { size: 'M', active: true, stock: 100 },
    { size: 'L', active: true, stock: 150 },
    { size: 'XL', active: true, stock: 100 },
    { size: 'XXL', active: true, stock: 50 },
    { size: 'XXXL', active: false, stock: 0 },
  ]);

  const [price, setPrice] = useState(699);
  const [gst, setGst] = useState(18);
  const [delivery, setDelivery] = useState(50);
  const [convenience, setConvenience] = useState(20);

  const [estimatedDays, setEstimatedDays] = useState(5);
  const [shippingPartner, setShippingPartner] = useState('Delhivery');
  const [enableLiveTracking, setEnableLiveTracking] = useState(true);

  const [paymentMandatory, setPaymentMandatory] = useState(true);
  const [allowRegistrationWithoutPayment, setAllowRegistrationWithoutPayment] = useState(false);
  const [autoActivateAfterPayment, setAutoActivateAfterPayment] = useState(false);
  const [requireAdminApproval, setRequireAdminApproval] = useState(true);

  useEffect(() => {
    fetchKit();
  }, []);

  const fetchKit = async () => {
    try {
      const res = await authFetch(`${API_URL}/starter-kits`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const kit = data[0];
          setKitId(kit._id);
          setName(kit.name || '');
          setDescription(kit.description || '');
          setStatus(kit.status || 'active');
          if (kit.items && kit.items.length > 0) setItems(kit.items);
          if (kit.sizes && kit.sizes.length > 0) setSizes(kit.sizes);
          setPrice(kit.price ?? 0);
          setGst(kit.gst ?? 0);
          setDelivery(kit.delivery ?? 0);
          setConvenience(kit.convenience ?? 0);
          setEstimatedDays(kit.estimatedDays ?? 5);
          setShippingPartner(kit.shippingPartner || '');
          setEnableLiveTracking(kit.enableLiveTracking ?? true);
          setPaymentMandatory(kit.paymentMandatory ?? true);
          setAllowRegistrationWithoutPayment(kit.allowRegistrationWithoutPayment ?? false);
          setAutoActivateAfterPayment(kit.autoActivateAfterPayment ?? false);
          setRequireAdminApproval(kit.requireAdminApproval ?? true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const payload = {
      name, description, status, items, sizes, price, gst, delivery, convenience,
      estimatedDays, shippingPartner, enableLiveTracking,
      paymentMandatory, allowRegistrationWithoutPayment, autoActivateAfterPayment, requireAdminApproval
    };
    try {
      const url = kitId ? `${API_URL}/starter-kits/${kitId}` : `${API_URL}/starter-kits`;
      const method = kitId ? 'PUT' : 'POST';
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setKitId(data._id || data.kit?._id);
        setIsEditing(false);
        messageApi.success('Configuration saved successfully');
      } else {
        messageApi.error('Failed to save configuration');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An error occurred while saving');
    }
  };

  const handleDelete = async () => {
    if (!kitId) return;
    if (!confirm('Are you sure you want to delete this configuration?')) return;
    try {
      const res = await authFetch(`${API_URL}/starter-kits/${kitId}`, { method: 'DELETE' });
      if (res.ok) {
        setKitId(null);
        setIsEditing(false);
        // We could also reset states here if desired
        setName('');
        setPrice(0);
        messageApi.success('Configuration deleted successfully');
      } else {
        messageApi.error('Failed to delete configuration');
      }
    } catch (err) {
      console.error(err);
      messageApi.error('An error occurred while deleting');
    }
  };

  const toggleSize = (index: number) => {
    const newSizes = [...sizes];
    newSizes[index].active = !newSizes[index].active;
    setSizes(newSizes);
  };

  const updateSizeStock = (index: number, stock: number) => {
    const newSizes = [...sizes];
    newSizes[index].stock = stock;
    setSizes(newSizes);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', description: '', stock: 0 }]);
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Loading configuration...</div>;

  const gstAmount = Math.round(price * (gst / 100));
  const total = price + gstAmount + delivery + convenience;

  return (
    <div className="space-y-8">
      {contextHolder}
      {/* Top Action Bar */}
      <div className="flex justify-end gap-3">
        {kitId && isEditing && (
          <button 
            type="button"
            onClick={handleDelete} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all bg-red-50 text-red-600 hover:bg-red-100"
          >
            <Trash size={16} /> Delete Kit
          </button>
        )}
        <button 
          type="button"
          onClick={() => setIsEditing(!isEditing)} 
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isEditing ? 'bg-blue-100 text-blue-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
        >
          <Edit size={16} /> {isEditing ? 'Cancel Edit' : 'Edit Configuration'}
        </button>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Starter Kit Name</label>
            <input disabled={!isEditing} type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Status</label>
            <select disabled={!isEditing} value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description</label>
            <textarea disabled={!isEditing} rows={2} value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed" />
          </div>
        </div>
      </div>

      {/* Included Items */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800">Included Items</h2>
          <button type="button" disabled={!isEditing} onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={16} /> Add Item
          </button>
        </div>
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200 items-start md:items-center bg-slate-50/50">
              <div className="flex-1 w-full">
                <input disabled={!isEditing} type="text" value={item.name} onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx].name = e.target.value;
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 mb-2 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Item Name" />
                <input disabled={!isEditing} type="text" value={item.description} onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx].description = e.target.value;
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Description" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stock</label>
                <input disabled={!isEditing} type="number" value={Number.isNaN(item.stock) ? '' : item.stock} onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx].stock = parseInt(e.target.value, 10) || 0;
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
              </div>
              <button type="button" disabled={!isEditing} onClick={() => removeItem(idx)} className="w-full md:w-auto p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* T-Shirt Config */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">T-Shirt Configuration</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Available Sizes & Inventory</p>
          <div className="space-y-3">
            {sizes.map((s, idx) => (
              <div key={s.size} className={`flex items-center justify-between p-3 rounded-xl border ${s.active ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50'} transition-all`}>
                <div className="flex items-center gap-3">
                  <input disabled={!isEditing} type="checkbox" checked={s.active} onChange={() => toggleSize(idx)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                  <span className={`font-black text-sm w-8 ${s.active ? 'text-blue-900' : 'text-slate-400'}`}>{s.size}</span>
                </div>
                {s.active && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Stock:</span>
                    <input disabled={!isEditing} type="number" value={Number.isNaN(s.stock) ? '' : s.stock} onChange={(e) => updateSizeStock(idx, parseInt(e.target.value, 10) || 0)} className="w-20 px-2 py-1 text-sm font-bold border border-slate-200 rounded-md outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Config */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Pricing & Charges</h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kit Base Price (₹)</label>
              <input disabled={!isEditing} type="number" value={Number.isNaN(price) ? '' : price} onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST (%)</label>
              <input disabled={!isEditing} type="number" value={Number.isNaN(gst) ? '' : gst} onChange={(e) => setGst(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Charge (₹)</label>
              <input disabled={!isEditing} type="number" value={Number.isNaN(delivery) ? '' : delivery} onChange={(e) => setDelivery(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Convenience Fee (₹)</label>
              <input disabled={!isEditing} type="number" value={Number.isNaN(convenience) ? '' : convenience} onChange={(e) => setConvenience(parseInt(e.target.value, 10) || 0)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
          </div>
          <div className="mt-6 p-4 bg-slate-900 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-slate-400 text-xs font-bold">Total Payable by Provider</p>
              <div className="flex gap-4 text-[10px] text-slate-500 font-medium">
                <span>Base: ₹{price}</span>
                <span>GST: ₹{gstAmount}</span>
                <span>Del: ₹{delivery}</span>
                <span>Fee: ₹{convenience}</span>
              </div>
            </div>
            <p className="text-2xl font-black text-white">₹{total}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Delivery Rules */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Delivery Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estimated Days</label>
              <input disabled={!isEditing} type="number" value={estimatedDays} onChange={e => setEstimatedDays(parseInt(e.target.value, 10) || 0)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Shipping Partner</label>
              <input disabled={!isEditing} type="text" value={shippingPartner} onChange={e => setShippingPartner(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>
            <label className={`flex items-center gap-3 p-3 border border-slate-200 rounded-xl ${isEditing ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed bg-slate-50'}`}>
              <input disabled={!isEditing} type="checkbox" checked={enableLiveTracking} onChange={e => setEnableLiveTracking(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
              <span className="text-sm font-bold text-slate-700">Enable Live Tracking</span>
            </label>
          </div>
        </div>

        {/* Payment & Automation Rules */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Payment & Rules</h2>
          <div className="space-y-3">
            <label className={`flex items-center justify-between p-3 border border-slate-200 rounded-xl ${isEditing ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed bg-slate-50'}`}>
              <span className="text-sm font-bold text-slate-700">Payment Mandatory</span>
              <input disabled={!isEditing} type="checkbox" checked={paymentMandatory} onChange={e => setPaymentMandatory(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </label>
            <label className={`flex items-center justify-between p-3 border border-slate-200 rounded-xl ${isEditing ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed bg-slate-50'}`}>
              <span className="text-sm font-bold text-slate-700">Allow Registration Without Payment</span>
              <input disabled={!isEditing} type="checkbox" checked={allowRegistrationWithoutPayment} onChange={e => setAllowRegistrationWithoutPayment(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </label>
            <label className={`flex items-center justify-between p-3 border border-slate-200 rounded-xl ${isEditing ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed bg-slate-50'}`}>
              <span className="text-sm font-bold text-slate-700">Auto-Activate After Payment</span>
              <input disabled={!isEditing} type="checkbox" checked={autoActivateAfterPayment} onChange={e => setAutoActivateAfterPayment(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </label>
            <label className={`flex items-center justify-between p-3 border border-slate-200 rounded-xl ${isEditing ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60 cursor-not-allowed bg-slate-50'}`}>
              <span className="text-sm font-bold text-slate-700">Require Admin Approval</span>
              <input disabled={!isEditing} type="checkbox" checked={requireAdminApproval} onChange={e => setRequireAdminApproval(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed" />
            </label>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="flex justify-end pt-4">
          <button type="button" onClick={handleSave} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
            <Save size={18} /> Save Configuration
          </button>
        </div>
      )}
    </div>
  );
}
