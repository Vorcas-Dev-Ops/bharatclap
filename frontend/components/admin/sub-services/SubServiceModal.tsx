"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Layers, Save, Tag, Activity, Palette, DollarSign,
  Clock, ImageIcon, ShieldCheck, Package, Plus, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant { name: string; price: string; duration: string; }
interface PkgForm { name: string; base_price: string; duration: string; variants: Variant[]; }

interface SubServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  subService: any | null;
  service: any;
  onSave: (subService: any) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyVariant = (): Variant => ({ name: '', price: '', duration: '' });
const emptyPackage = (): PkgForm => ({ name: '', base_price: '', duration: '', variants: [] });

const pkgColors = [
  'from-violet-500 to-purple-600',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-sky-500 to-blue-600',
];

// ─── Component ────────────────────────────────────────────────────────────────

const SubServiceModal: React.FC<SubServiceModalProps> = ({ isOpen, onClose, subService, service, onSave }) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'packages'>('basic');
  const [activePkgIdx, setActivePkgIdx] = useState(0);

  const [formData, setFormData] = useState({
    subservice_name: '',
    description: '',
    service_preparations: [] as { title: string; isMandatory: boolean }[],
    image: '',
    status: 'active',
    hasPackages: false,
  });

  const [packages, setPackages] = useState<PkgForm[]>([emptyPackage()]);

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Populate on open ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) { document.body.style.overflow = 'unset'; return; }
    document.body.style.overflow = 'hidden';
    setActiveTab('basic');
    setActivePkgIdx(0);

    if (subService) {
      setFormData({
        subservice_name: subService.subservice_name || '',
        description: subService.description || '',
        service_preparations: (subService.service_preparations || []).map((p: any) => ({
          title: p.title, isMandatory: p.isMandatory ?? false,
        })),
        image: subService.image || '',
        status: subService.status || 'active',
        hasPackages: subService.hasPackages ?? false,
      });

      // If it's a package-based service, load the packages
      if (subService.hasPackages && subService.packages && subService.packages.length > 0) {
        setPackages(subService.packages.map((pkg: any) => ({
          name: pkg.name || '',
          base_price: String(pkg.base_price ?? ''),
          duration: String(pkg.duration ?? ''),
          variants: (pkg.variants || []).map((v: any) => ({
            name: v.name, price: String(v.price), duration: String(v.duration),
          })),
        })));
      } else {
        // If it's standard pricing (or legacy), seed the unified state from flat fields
        setPackages([{
          name: '', // Empty because standard pricing doesn't use names
          base_price: String(subService.base_price ?? ''),
          duration: String(subService.duration ?? ''),
          variants: (subService.variants || []).map((v: any) => ({
            name: v.name, price: String(v.price), duration: String(v.duration),
          })),
        }]);
      }
    } else {
      setFormData({ subservice_name: '', description: '', service_preparations: [], image: '', status: 'active', hasPackages: false });
      setPackages([emptyPackage()]);
    }

    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, subService]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const builtPackages = packages.map((pkg, idx) => ({
      name: pkg.name || (formData.hasPackages ? `Package ${idx + 1}` : 'Standard'),
      base_price: Number(pkg.base_price),
      duration: Number(pkg.duration),
      variants: pkg.variants.map(v => ({
        name: v.name, price: Number(v.price), duration: Number(v.duration),
      })),
    }));

    // Derive top-level legacy fields from first package for backward compatibility
    const firstPkg = builtPackages[0];

    onSave({
      ...formData,
      service_id: service._id,
      // Flat fields
      base_price: firstPkg?.base_price,
      duration: firstPkg?.duration,
      variants: firstPkg?.variants ?? [],
      // Only save packages array if hasPackages is true
      packages: formData.hasPackages ? builtPackages : [],
      service_preparations: formData.service_preparations,
      hasPackages: formData.hasPackages,
    });
  };

  // ── Package helpers ────────────────────────────────────────────────────────
  const updatePkg = (idx: number, field: keyof PkgForm, value: any) => {
    setPackages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const addPackage = () => {
    setPackages(prev => [...prev, emptyPackage()]);
    setActivePkgIdx(packages.length);
  };

  const removePackage = (idx: number) => {
    if (packages.length === 1) return;
    setPackages(prev => prev.filter((_, i) => i !== idx));
    setActivePkgIdx(Math.max(0, activePkgIdx - 1));
  };

  const addVariant = (pkgIdx: number) => {
    setPackages(prev => prev.map((p, i) =>
      i === pkgIdx ? { ...p, variants: [...p.variants, emptyVariant()] } : p
    ));
  };

  const updateVariant = (pkgIdx: number, vIdx: number, field: keyof Variant, value: string) => {
    setPackages(prev => prev.map((p, i) => {
      if (i !== pkgIdx) return p;
      const vs = [...p.variants];
      vs[vIdx] = { ...vs[vIdx], [field]: value };
      return { ...p, variants: vs };
    }));
  };

  const removeVariant = (pkgIdx: number, vIdx: number) => {
    setPackages(prev => prev.map((p, i) =>
      i === pkgIdx ? { ...p, variants: p.variants.filter((_, vi) => vi !== vIdx) } : p
    ));
  };

  // ─── Preparations helpers ──────────────────────────────────────────────────
  const addPrep = () => setFormData(f => ({
    ...f, service_preparations: [...f.service_preparations, { title: '', isMandatory: false }],
  }));

  const updatePrep = (idx: number, field: 'title' | 'isMandatory', value: any) => {
    setFormData(f => {
      const updated = [...f.service_preparations];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...f, service_preparations: updated };
    });
  };

  const removePrep = (idx: number) => setFormData(f => ({
    ...f, service_preparations: f.service_preparations.filter((_, i) => i !== idx),
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!mounted || !isOpen) return null;

  const activePkg = packages[activePkgIdx] ?? packages[0];

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          key="ss-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal */}
        <motion.div
          key="ss-modal"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-8 pt-6 pb-4 flex justify-between items-center flex-shrink-0 border-b border-gray-50">
            <div>
              <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.08em]">
                {subService ? 'Edit Sub-Service' : 'New Sub-Service'}
              </h2>
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                Under {service?.service_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 px-8 pt-4 flex-shrink-0">
            {(['basic', 'packages'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                {tab === 'basic' ? '① Basic Info' : `② Pricing`}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-8 py-5 space-y-4 custom-scrollbar">

              {/* ─── BASIC TAB ──────────────────────────────────────────── */}
              {activeTab === 'basic' && (
                <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4">

                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <Tag size={12} className="text-blue-500" /> Sub-Service Name
                    </label>
                    <input
                      type="text" required
                      placeholder="e.g. Full Home Cleaning"
                      value={formData.subservice_name}
                      onChange={e => setFormData(f => ({ ...f, subservice_name: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                      <Layers size={12} className="text-blue-500" /> Description
                    </label>
                    <textarea
                      required rows={2}
                      value={formData.description}
                      onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all resize-none"
                    />
                  </div>

                  {/* Service Preparations */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                        <ShieldCheck size={12} className="text-blue-500" /> Preparation Instructions
                      </label>
                      <button type="button" onClick={addPrep}
                        className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                        + Add
                      </button>
                    </div>
                    {formData.service_preparations.map((p, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-white p-3 rounded-2xl border border-gray-50 shadow-sm group/prep">
                        <input
                          type="text" required
                          placeholder="e.g. Power supply must be available"
                          value={p.title}
                          onChange={e => updatePrep(idx, 'title', e.target.value)}
                          className="flex-1 px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                          <input
                            type="checkbox" checked={p.isMandatory}
                            onChange={e => updatePrep(idx, 'isMandatory', e.target.checked)}
                            className="w-3 h-3 accent-blue-600 cursor-pointer"
                          />
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Mandatory</span>
                        </label>
                        <button type="button" onClick={() => removePrep(idx)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover/prep:opacity-100">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Image + Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <ImageIcon size={12} className="text-blue-500" /> Image URL
                      </label>
                      <input
                        type="text"
                        value={formData.image}
                        onChange={e => setFormData(f => ({ ...f, image: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                        <Activity size={12} className="text-blue-500" /> Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={e => setFormData(f => ({ ...f, status: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── PRICING TAB ────────────────────────────────────────── */}
              {activeTab === 'packages' && (
                <div className="space-y-4">
                  {/* Pricing Type Toggle */}
                  <div className="bg-[#F8FAFC] border border-gray-100 p-4 rounded-[2rem] flex flex-col gap-2">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 uppercase">
                      Pricing Type
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pricingType"
                          checked={!formData.hasPackages}
                          onChange={() => {
                            setFormData(f => ({ ...f, hasPackages: false }));
                            setPackages([packages[0] || emptyPackage()]);
                            setActivePkgIdx(0);
                          }}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-xs font-bold text-gray-700">Standard Pricing</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="pricingType"
                          checked={formData.hasPackages}
                          onChange={() => {
                            setFormData(f => ({ ...f, hasPackages: true }));
                            // if they switch to packages, ensure the first one has a name
                            if (!packages[0]?.name || packages[0].name === 'Standard') {
                              updatePkg(0, 'name', 'Prime');
                            }
                          }}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <span className="text-xs font-bold text-gray-700">Package-Based Pricing</span>
                      </label>
                    </div>
                  </div>

                  {/* Package Tabs (Only if hasPackages is true) */}
                  {formData.hasPackages && (
                    <div className="flex gap-2 flex-wrap">
                      {packages.map((pkg, idx) => (
                        <button
                          key={idx} type="button"
                          onClick={() => setActivePkgIdx(idx)}
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                            activePkgIdx === idx
                              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                              : 'bg-white text-gray-500 border-gray-100 hover:border-blue-200'
                          }`}
                        >
                          {pkg.name || `Package ${idx + 1}`}
                        </button>
                      ))}
                      <button
                        type="button" onClick={addPackage}
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 transition-all flex items-center gap-1"
                      >
                        <Plus size={10} /> Add Package
                      </button>
                    </div>
                  )}

                  {/* Active Package Editor */}
                  {activePkg && (
                    <div className="bg-[#F8FAFC] border border-gray-100 p-6 rounded-[2rem] space-y-4">
                      
                      {formData.hasPackages && (
                        <>
                          {/* Package header */}
                          <div className="flex justify-between items-center">
                            <div className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white bg-gradient-to-r ${pkgColors[activePkgIdx % pkgColors.length]}`}>
                              Package {activePkgIdx + 1}
                            </div>
                            {packages.length > 1 && (
                              <button
                                type="button" onClick={() => removePackage(activePkgIdx)}
                                className="text-[8px] font-black text-red-400 uppercase tracking-widest hover:underline flex items-center gap-1"
                              >
                                <Trash2 size={10} /> Remove
                              </button>
                            )}
                          </div>

                          {/* Package Name */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                              <Package size={12} className="text-blue-500" /> Package Name
                            </label>
                            <input
                              type="text" required={formData.hasPackages}
                              placeholder="e.g. Prime, Luxury, Premium"
                              value={activePkg.name}
                              onChange={e => updatePkg(activePkgIdx, 'name', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                            />
                          </div>
                        </>
                      )}

                      {/* Base Price + Duration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <DollarSign size={12} className="text-blue-500" /> Base Price (₹)
                          </label>
                          <input
                            type="number" required min="0"
                            value={activePkg.base_price}
                            onChange={e => updatePkg(activePkgIdx, 'base_price', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-2">
                            <Clock size={12} className="text-blue-500" /> Duration (Mins)
                          </label>
                          <input
                            type="number" required min="1"
                            value={activePkg.duration}
                            onChange={e => updatePkg(activePkgIdx, 'duration', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
                          />
                        </div>
                      </div>

                      {/* Variants */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-gray-400 tracking-widest flex items-center gap-2">
                            <Palette size={12} className="text-blue-500" /> Variants (e.g. 1 BHK, 2 BHK)
                          </label>
                          <button
                            type="button" onClick={() => addVariant(activePkgIdx)}
                            className="text-[8px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                          >
                            + Add Variant
                          </button>
                        </div>

                        {activePkg.variants.length === 0 && (
                          <p className="text-[9px] text-gray-400 text-center py-3 font-bold">
                            No variants — customers will see the base price only.
                          </p>
                        )}

                        <div className="space-y-2">
                          {activePkg.variants.map((v, vIdx) => (
                            <div key={vIdx} className="flex gap-2 items-start bg-white p-3 rounded-2xl border border-gray-50 shadow-sm relative group/variant">
                              <div className="flex-1 space-y-2">
                                <input
                                  type="text"
                                  placeholder="Variant name (e.g. 2 BHK)"
                                  value={v.name}
                                  onChange={e => updateVariant(activePkgIdx, vIdx, 'name', e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="number" placeholder="Price (₹)" min="0"
                                    value={v.price}
                                    onChange={e => updateVariant(activePkgIdx, vIdx, 'price', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                                  />
                                  <input
                                    type="number" placeholder="Mins" min="1"
                                    value={v.duration}
                                    onChange={e => updateVariant(activePkgIdx, vIdx, 'duration', e.target.value)}
                                    className="flex-1 px-3 py-2 bg-gray-50/50 border border-transparent rounded-xl text-[10px] font-bold focus:bg-white focus:border-blue-100 transition-all"
                                  />
                                </div>
                              </div>
                              <button
                                type="button" onClick={() => removeVariant(activePkgIdx, vIdx)}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover/variant:opacity-100"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-8 pb-8 pt-4 bg-white border-t border-gray-100 flex gap-3">
              {activeTab === 'basic' ? (
                <>
                  <button type="button" onClick={onClose}
                    className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-gray-200">
                    Cancel
                  </button>
                  <button type="button" onClick={() => setActiveTab('packages')}
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-200 hover:scale-105 transition-all">
                    Next → Packages
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setActiveTab('basic')}
                    className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black tracking-widest uppercase hover:bg-gray-200">
                    ← Back
                  </button>
                  <button type="submit"
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-200 hover:scale-105 transition-all flex items-center justify-center gap-2">
                    <Save size={14} /> {subService ? 'Update' : 'Create'} Sub-Service
                  </button>
                </>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default SubServiceModal;
