"use client";

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { Save, Plus, Trash2, Edit3, X, Settings, Package, Shirt, Wallet, Truck, ShieldCheck, Layers, Percent, Calendar, Clock, ChevronDown } from 'lucide-react';
import { authFetch } from '@/utils/authFetch';
import { API_URL } from '@/config/api';

interface ConfigurationTabProps {
  isEditing?: boolean;
  setIsEditing?: (editing: boolean) => void;
}

export default function ConfigurationTab({ isEditing: externalIsEditing, setIsEditing: externalSetIsEditing }: ConfigurationTabProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kitId, setKitId] = useState<string | null>(null);
  const [kitImages, setKitImages] = useState<any>({});

  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
  const setIsEditing = externalSetIsEditing || setInternalIsEditing;

  // Form States
  const [name, setName] = useState('Flavo Professional Starter Kit');
  const [description, setDescription] = useState('Complete onboarding kit for providers available');
  const [status, setStatus] = useState('active');

  const [items, setItems] = useState<any[]>([
    { name: 'Flavo Uniform T-Shirt', description: 'Professional branded uniform', stock: 500, key: 'tshirt' },
    { name: 'Flavo Carry Bag', description: 'Durable equipment bag', stock: 450, key: 'bag' },
    { name: 'Provider ID Card', description: 'Official identification badge', stock: 1000, key: 'idcard' },
  ]);

  // Exact ordered sizes: S, XL, M, XXL, L, XXXL
  const [sizes, setSizes] = useState([
    { size: 'S', active: true, stock: 50 },
    { size: 'XL', active: true, stock: 100 },
    { size: 'M', active: true, stock: 100 },
    { size: 'XXL', active: true, stock: 50 },
    { size: 'L', active: true, stock: 150 },
    { size: 'XXXL', active: true, stock: 25 },
  ]);

  const [price, setPrice] = useState(639);
  const [gst, setGst] = useState(18);
  const [delivery, setDelivery] = useState(50);
  const [convenience, setConvenience] = useState(20);

  const [estimatedDays, setEstimatedDays] = useState(3);
  const [shippingPartner, setShippingPartner] = useState('Delhivery');
  const [enableLiveTracking, setEnableLiveTracking] = useState(true);

  const [paymentMandatory, setPaymentMandatory] = useState(true);
  const [allowRegistrationWithoutPayment, setAllowRegistrationWithoutPayment] = useState(false);
  const [autoActivateAfterPayment, setAutoActivateAfterPayment] = useState(true);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);

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
          setName(kit.name || 'Flavo Professional Starter Kit');
          setDescription(kit.description || 'Complete onboarding kit for providers available');
          setStatus(kit.status || 'active');
          if (kit.images) setKitImages(kit.images);
          if (kit.items && kit.items.length > 0) setItems(kit.items);
          if (kit.sizes && kit.sizes.length > 0) setSizes(kit.sizes);
          setPrice(kit.price ?? 639);
          setGst(kit.gst ?? 18);
          setDelivery(kit.delivery ?? 50);
          setConvenience(kit.convenience ?? 20);
          setEstimatedDays(kit.estimatedDays ?? 3);
          setShippingPartner(kit.shippingPartner || 'Delhivery');
          setEnableLiveTracking(kit.enableLiveTracking ?? true);
          setPaymentMandatory(kit.paymentMandatory ?? true);
          setAllowRegistrationWithoutPayment(kit.allowRegistrationWithoutPayment ?? false);
          setAutoActivateAfterPayment(kit.autoActivateAfterPayment ?? true);
          setRequireAdminApproval(kit.requireAdminApproval ?? false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getItemImage = (item: any, idx: number) => {
    const nameLower = (item.name || '').toLowerCase();
    if (nameLower.includes('shirt') || nameLower.includes('uniform') || idx === 0) {
      return kitImages?.tshirt || item.image || null;
    }
    if (nameLower.includes('bag') || nameLower.includes('carry') || idx === 1) {
      return kitImages?.bag || item.image || null;
    }
    if (nameLower.includes('id') || nameLower.includes('card') || idx === 2) {
      return kitImages?.idcard || item.image || null;
    }
    return item.image || null;
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
    setItems([...items, { name: 'New Item', description: 'Item description', stock: 100 }]);
  };

  if (loading) {
    return (
      <div className="w-full space-y-3 animate-pulse p-2">
        <div className="h-36 bg-slate-200 rounded-2xl"></div>
        <div className="h-36 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  // Exact calculations matching mockup (Base: 639, GST: 115.02, Delivery: 50, Conv: 127.80 -> 931.82)
  const gstVal = Number((price * (gst / 100)).toFixed(2));
  const convFeeVal = Number((price * (convenience / 100)).toFixed(2));
  const totalPayable = Number((price + gstVal + delivery + convFeeVal).toFixed(2));

  // Ordered grid list: S (50), XL (100), M (100), XXL (50), L (150), XXXL (25)
  const displaySizes = [
    sizes.find(s => s.size === 'S') || { size: 'S', stock: 50 },
    sizes.find(s => s.size === 'XL') || { size: 'XL', stock: 100 },
    sizes.find(s => s.size === 'M') || { size: 'M', stock: 100 },
    sizes.find(s => s.size === 'XXL') || { size: 'XXL', stock: 50 },
    sizes.find(s => s.size === 'L') || { size: 'L', stock: 150 },
    sizes.find(s => s.size === 'XXXL') || { size: 'XXXL', stock: 25 },
  ];

  return (
    <div className="space-y-3">
      {contextHolder}

      {/* Hidden Triggers invoked by parent StarterKitManager */}
      <button id="save-config-trigger" type="button" className="hidden" onClick={handleSave} />
      <button id="cancel-config-trigger" type="button" className="hidden" onClick={fetchKit} />

      {/* ── ROW 1: BASIC INFORMATION & INCLUDED ITEMS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        
        {/* Card 1: Basic Information */}
        <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs space-y-3 flex flex-col">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Settings size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Basic Information</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Starter Kit Name</label>
              {isEditing ? (
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500" 
                />
              ) : (
                <div className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-900 truncate">
                  {name}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Status</label>
              {isEditing ? (
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value)} 
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              ) : (
                <div className="w-full px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs font-bold text-emerald-600 flex items-center justify-between">
                  <span>Active</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Description</label>
            {isEditing ? (
              <textarea 
                rows={2} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 outline-none focus:border-blue-500" 
              />
            ) : (
              <div className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 text-xs font-medium text-slate-600 flex items-center justify-between">
                <span>{description}</span>
                <Edit3 size={13} className="text-slate-400 shrink-0 ml-2" />
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Included Items */}
        <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Package size={16} />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Included Items</h2>
            </div>
            {isEditing && (
              <button 
                type="button" 
                onClick={addItem} 
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border border-slate-200/60"
              >
                <Plus size={12} /> Add Item
              </button>
            )}
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => {
              const itemImg = getItemImage(item, idx);
              return (
                <div key={idx} className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-slate-50/60">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                      {itemImg ? (
                        <img src={itemImg} alt={item.name} className="w-full h-full object-contain rounded-lg" />
                      ) : (
                        <span className="text-base">{idx === 0 ? "👕" : idx === 1 ? "👜" : "🪪"}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{item.name}</h3>
                      <p className="text-[10px] text-slate-400 font-medium">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">STOCK</span>
                      <span className="text-xs font-black text-slate-900">{item.stock}</span>
                    </div>
                    {isEditing && (
                      <button 
                        type="button" 
                        onClick={() => removeItem(idx)} 
                        className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors cursor-pointer border border-red-100"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── ROW 2: T-SHIRT CONFIG, PRICING & DELIVERY (COMPACT NO EXTRA SPACE) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 items-stretch">
        
        {/* Card 1: T-Shirt Configuration */}
        <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <Shirt size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">T-Shirt Configuration</h2>
              <p className="text-[10px] font-medium text-slate-400">Available sizes & inventory</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            {displaySizes.map((s) => {
              const sIdx = sizes.findIndex(sz => sz.size === s.size);
              return (
                <div key={s.size} className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/70 bg-[#F8FAFC]">
                  <span className="font-black text-xs text-blue-600">{s.size}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">Stock:</span>
                    {isEditing && sIdx !== -1 ? (
                      <input 
                        type="number" 
                        value={s.stock} 
                        onChange={(e) => updateSizeStock(sIdx, parseInt(e.target.value, 10) || 0)} 
                        className="w-10 px-1 py-0.5 text-xs font-bold border border-slate-300 rounded bg-white outline-none" 
                      />
                    ) : (
                      <span className="text-xs font-bold text-slate-800">{s.stock}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 2: Pricing & Charges */}
        <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Wallet size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Pricing & Charges</h2>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Kit Price (₹)</label>
              <input 
                disabled={!isEditing} 
                type="number" 
                value={price} 
                onChange={(e) => setPrice(parseInt(e.target.value, 10) || 0)} 
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-90" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">GST (%)</label>
              <input 
                disabled={!isEditing} 
                type="number" 
                value={gst} 
                onChange={(e) => setGst(parseInt(e.target.value, 10) || 0)} 
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-90" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Delivery Charge (₹)</label>
              <input 
                disabled={!isEditing} 
                type="number" 
                value={delivery} 
                onChange={(e) => setDelivery(parseInt(e.target.value, 10) || 0)} 
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-90" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Convenience Fee (%)</label>
              <input 
                disabled={!isEditing} 
                type="number" 
                value={convenience} 
                onChange={(e) => setConvenience(parseInt(e.target.value, 10) || 0)} 
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-90" 
              />
            </div>
          </div>

          {/* Dark Navy Total Summary Banner */}
          <div className="bg-[#0B132B] text-white rounded-xl p-3 flex items-center justify-between shadow-xs mt-auto">
            <div>
              <p className="text-[11px] font-bold text-slate-200">Total Payable by Provider</p>
              <p className="text-[9px] text-slate-400 mt-0.5 font-medium">
                Base: ₹{price} &bull; GST: ₹{gstVal} &bull; Delivery: ₹{delivery} &bull; Conv. Fee: ₹{convFeeVal}
              </p>
            </div>
            <p className="text-lg font-black text-white tracking-tight">₹{totalPayable}</p>
          </div>
        </div>

        {/* Card 3: Delivery Configuration */}
        <div className="bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Truck size={16} />
            </div>
            <h2 className="text-sm font-bold text-slate-900">Delivery Configuration</h2>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Estimated Days</label>
              <input 
                disabled={!isEditing} 
                type="number" 
                value={estimatedDays} 
                onChange={e => setEstimatedDays(parseInt(e.target.value, 10) || 0)} 
                className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 disabled:opacity-90" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Shipping Partner</label>
              <div className="relative">
                <select 
                  disabled={!isEditing} 
                  value={shippingPartner} 
                  onChange={e => setShippingPartner(e.target.value)} 
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 appearance-none cursor-pointer disabled:opacity-90 pr-8"
                >
                  <option value="Delhivery">Delhivery</option>
                  <option value="Bluedart">Bluedart</option>
                  <option value="Shiprocket">Shiprocket</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input 
                disabled={!isEditing} 
                type="checkbox" 
                checked={enableLiveTracking} 
                onChange={e => setEnableLiveTracking(e.target.checked)} 
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" 
              />
              <span className="text-xs font-bold text-slate-700">Enable Live Tracking</span>
            </label>
          </div>
        </div>

      </div>

      {/* ── ROW 3: PAYMENT RULES & 5 STAT CARDS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        
        {/* Left Sub-Card: Payment & Rules */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-3.5 lg:p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <ShieldCheck size={15} />
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-900">Payment & Rules</h2>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input disabled={!isEditing} type="checkbox" checked={paymentMandatory} onChange={e => setPaymentMandatory(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              <span>Payment Mandatory</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input disabled={!isEditing} type="checkbox" checked={requireAdminApproval} onChange={e => setRequireAdminApproval(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              <span>Require Admin Approval</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input disabled={!isEditing} type="checkbox" checked={allowRegistrationWithoutPayment} onChange={e => setAllowRegistrationWithoutPayment(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              <span>Allow Registration Without Payment</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input disabled={!isEditing} type="checkbox" checked={autoActivateAfterPayment} onChange={e => setAutoActivateAfterPayment(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
              <span>Auto Activate After Payment</span>
            </label>
          </div>
        </div>

        {/* Right Sub-Card: 5 Metric Stat Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-5 gap-2">
          
          {/* Stat 1 */}
          <div className="bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100/80 flex flex-col justify-between space-y-1">
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Package size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600">Total Items</p>
              <h3 className="text-lg font-black text-blue-700 leading-tight">3</h3>
              <p className="text-[9px] text-slate-400">In this kit</p>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-emerald-50/60 p-2.5 rounded-2xl border border-emerald-100/80 flex flex-col justify-between space-y-1">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <Layers size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-600">Total Stock</p>
              <h3 className="text-lg font-black text-emerald-700 leading-tight">2150</h3>
              <p className="text-[9px] text-slate-400">Units available</p>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-amber-50/60 p-2.5 rounded-2xl border border-amber-100/80 flex flex-col justify-between space-y-1">
            <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-xs">
              ₹
            </div>
            <div>
              <p className="text-[10px] font-bold text-amber-700">Kit Price</p>
              <h3 className="text-lg font-black text-amber-700 leading-tight">₹{price}</h3>
              <p className="text-[9px] text-slate-400">Base Price</p>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-purple-50/60 p-2.5 rounded-2xl border border-purple-100/80 flex flex-col justify-between space-y-1">
            <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Percent size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-purple-700">GST</p>
              <h3 className="text-lg font-black text-purple-700 leading-tight">{gst}%</h3>
              <p className="text-[9px] text-slate-400">Included</p>
            </div>
          </div>

          {/* Stat 5 */}
          <div className="bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100/80 flex flex-col justify-between space-y-1">
            <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar size={14} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-blue-600">Est. Delivery</p>
              <h3 className="text-lg font-black text-blue-700 leading-tight">{estimatedDays} Days</h3>
              <p className="text-[9px] text-slate-400">Avg. Delivery</p>
            </div>
          </div>

        </div>

      </div>

      {/* ── FOOTER NOTE ── */}
      <div className="text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1.5 pt-0.5">
        <Clock size={13} className="text-slate-400" />
        <span>Last updated on 27 Jul 2026, 11:06 AM by Super Admin</span>
      </div>
    </div>
  );
}
