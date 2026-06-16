"use client";

import React, { useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';

export default function ConfigurationTab() {
  const [items, setItems] = useState([
    { id: 1, name: 'Fixvo Uniform T-Shirt', description: 'Professional branded uniform', stock: 500 },
    { id: 2, name: 'Fixvo Carry Bag', description: 'Durable equipment bag', stock: 450 },
    { id: 3, name: 'Provider ID Card', description: 'Official identification lanyard', stock: 1000 },
  ]);

  const [sizes, setSizes] = useState([
    { size: 'S', active: true, stock: 50 },
    { size: 'M', active: true, stock: 100 },
    { size: 'L', active: true, stock: 150 },
    { size: 'XL', active: true, stock: 100 },
    { size: 'XXL', active: true, stock: 50 },
    { size: 'XXXL', active: false, stock: 0 },
  ]);

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

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const [price, setPrice] = useState(699);
  const [gst, setGst] = useState(18);
  const [delivery, setDelivery] = useState(50);
  const [convenience, setConvenience] = useState(20);

  const gstAmount = Math.round(price * (gst / 100));
  const total = price + gstAmount + delivery + convenience;

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Starter Kit Name</label>
            <input type="text" defaultValue="Fixvo Professional Starter Kit" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Status</label>
            <select className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Description</label>
            <textarea rows={2} defaultValue="Complete onboarding kit for providers" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
          </div>
        </div>
      </div>

      {/* Included Items */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-800">Included Items</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-lg transition-colors">
            <Plus size={16} /> Add Item
          </button>
        </div>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200 items-start md:items-center bg-slate-50/50">
              <div className="flex-1 w-full">
                <input type="text" value={item.name} onChange={(e) => {
                  const newItems = [...items];
                  newItems.find(i => i.id === item.id)!.name = e.target.value;
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500 mb-2" placeholder="Item Name" />
                <input type="text" value={item.description} onChange={(e) => {
                  const newItems = [...items];
                  newItems.find(i => i.id === item.id)!.description = e.target.value;
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 outline-none focus:border-blue-500" placeholder="Description" />
              </div>
              <div className="w-full md:w-32">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Stock</label>
                <input type="number" value={Number.isNaN(item.stock) ? '' : item.stock} onChange={(e) => {
                  const newItems = [...items];
                  newItems.find(i => i.id === item.id)!.stock = parseInt(e.target.value, 10);
                  setItems(newItems);
                }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
              </div>
              <button onClick={() => removeItem(item.id)} className="w-full md:w-auto p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center">
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
                  <input type="checkbox" checked={s.active} onChange={() => toggleSize(idx)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                  <span className={`font-black text-sm w-8 ${s.active ? 'text-blue-900' : 'text-slate-400'}`}>{s.size}</span>
                </div>
                {s.active && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Stock:</span>
                    <input type="number" value={Number.isNaN(s.stock) ? '' : s.stock} onChange={(e) => updateSizeStock(idx, parseInt(e.target.value, 10))} className="w-20 px-2 py-1 text-sm font-bold border border-slate-200 rounded-md outline-none focus:border-blue-500" />
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
              <input type="number" value={Number.isNaN(price) ? '' : price} onChange={(e) => setPrice(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GST (%)</label>
              <input type="number" value={Number.isNaN(gst) ? '' : gst} onChange={(e) => setGst(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Charge (₹)</label>
              <input type="number" value={Number.isNaN(delivery) ? '' : delivery} onChange={(e) => setDelivery(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Convenience Fee (₹)</label>
              <input type="number" value={Number.isNaN(convenience) ? '' : convenience} onChange={(e) => setConvenience(parseInt(e.target.value, 10))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
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
              <input type="number" defaultValue={5} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Shipping Partner</label>
              <input type="text" defaultValue="Delhivery" className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:border-blue-500" />
            </div>
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-bold text-slate-700">Enable Live Tracking</span>
            </label>
          </div>
        </div>

        {/* Payment & Automation Rules */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Payment & Rules</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-700">Payment Mandatory</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
            </label>
            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-700">Allow Registration Without Payment</span>
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
            </label>
            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-700">Auto-Activate After Payment</span>
              <input type="checkbox" className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
            </label>
            <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50">
              <span className="text-sm font-bold text-slate-700">Require Admin Approval</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
          <Save size={18} /> Save Configuration
        </button>
      </div>
    </div>
  );
}
