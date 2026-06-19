"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Wrench, Save, Tag, Activity, Palette, DollarSign,
  List, Plus, Trash2, ChevronRight, ArrowLeft, CheckCircle2, Package
} from 'lucide-react';

interface AccessoryItem {
  title: string;
  description: string;
  price: number | string;
  image: string;
  status: 'active' | 'inactive';
}

interface AccessoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessory: any | null;
  categories: any[];
  onSave: (accessory: any) => void;
}

const emptyItem = (): AccessoryItem => ({
  title: '',
  description: '',
  price: '',
  image: '',
  status: 'active',
});

const AccessoryModal: React.FC<AccessoryModalProps> = ({
  isOpen, onClose, accessory, categories, onSave
}) => {
  const [mounted, setMounted] = useState(false);

  // Step 1 — category selection; Step 2 — fill accessories
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCategory, setSelectedCategory] = useState('');

  // Edit mode: single item (pre-filled)
  const [items, setItems] = useState<AccessoryItem[]>([emptyItem()]);

  // ─── mount guard ─────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ─── reset / pre-fill when modal opens ───────────────────────────
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = 'unset';
      return;
    }
    document.body.style.overflow = 'hidden';

    if (accessory) {
      // Edit mode: jump straight to step 2 with pre-filled data
      setSelectedCategory(accessory.category?._id || accessory.category || '');
      setItems([{
        title: accessory.title || '',
        description: accessory.description || '',
        price: accessory.price ?? '',
        image: accessory.image || '',
        status: accessory.status || 'active',
      }]);
      setStep(2);
    } else {
      // Add mode: start at step 1
      setSelectedCategory(categories.length > 0 ? categories[0]._id : '');
      setItems([emptyItem()]);
      setStep(1);
    }

    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, accessory, categories]);

  // ─── item helpers ─────────────────────────────────────────────────
  const updateItem = (index: number, field: keyof AccessoryItem, value: string) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === 'price' ? value : value };
      return next;
    });
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // ─── submission ───────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessory) {
      // Edit: save single item
      onSave({ ...items[0], category: selectedCategory, price: Number(items[0].price) });
    } else {
      // Add: save all items sequentially
      items.forEach(item => {
        onSave({ ...item, category: selectedCategory, price: Number(item.price) });
      });
    }
    onClose();
  };

  const selectedCategoryName = categories.find(c => c._id === selectedCategory)?.category_name || '';

  if (!mounted || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          key="acc-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        />

        {/* Modal */}
        <motion.div
          key="acc-modal"
          initial={{ opacity: 0, scale: 0.92, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 30 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden z-[9999] border border-white/20 pointer-events-auto max-h-[90vh] flex flex-col"
        >
          {/* ── Header ── */}
          <div className="px-8 pt-6 pb-4 flex justify-between items-center flex-shrink-0 border-b border-gray-50">
            <div className="flex items-center gap-3">
              {step === 2 && !accessory && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <ArrowLeft size={16} className="text-gray-400" />
                </button>
              )}
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-[0.08em]">
                  {accessory ? 'Edit Accessory' : step === 1 ? 'Select Category' : 'Add Accessories'}
                </h2>
                {step === 2 && selectedCategoryName && (
                  <p className="text-[10px] font-bold text-blue-500 tracking-widest mt-0.5">
                    {selectedCategoryName}
                  </p>
                )}
              </div>
            </div>

            {/* Step pill (add mode only) */}
            {!accessory && (
              <div className="flex items-center gap-2 mr-4">
                <StepDot active={step === 1} done={step > 1} label="1" />
                <div className={`w-6 h-0.5 rounded-full transition-all ${step > 1 ? 'bg-blue-500' : 'bg-gray-200'}`} />
                <StepDot active={step === 2} done={false} label="2" />
              </div>
            )}

            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* ── Body ── */}
          <AnimatePresence mode="wait">
            {step === 1 ? (
              /* ── STEP 1: Category picker ── */
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar"
              >
                <p className="text-xs text-gray-500 font-semibold mb-5">
                  Choose the category you want to add accessories to.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map(cat => (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => setSelectedCategory(cat._id)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                        selectedCategory === cat._id
                          ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100'
                          : 'border-gray-100 bg-[#F8FAFC] hover:border-blue-200 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedCategory === cat._id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        <Package size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-black truncate ${selectedCategory === cat._id ? 'text-blue-700' : 'text-gray-700'}`}>
                          {cat.category_name}
                        </p>
                        {cat.description && (
                          <p className="text-[10px] text-gray-400 font-medium truncate">{cat.description}</p>
                        )}
                      </div>
                      {selectedCategory === cat._id && (
                        <CheckCircle2 size={16} className="text-blue-500 ml-auto flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              /* ── STEP 2: Accessories form ── */
              <motion.form
                key="step2"
                id="accessories-form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="flex-1 overflow-y-auto px-8 py-6 space-y-5 custom-scrollbar"
              >
                {items.map((item, index) => (
                  <AccessoryItemCard
                    key={index}
                    index={index}
                    item={item}
                    total={items.length}
                    onChange={updateItem}
                    onRemove={() => removeItem(index)}
                    isEdit={!!accessory}
                  />
                ))}

                {!accessory && (
                  <button
                    type="button"
                    onClick={addItem}
                    className="w-full py-3.5 border-2 border-dashed border-blue-200 text-blue-500 rounded-2xl text-xs font-black tracking-widest hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> Add Another Accessory
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          {/* ── Footer ── */}
          <div className="flex-shrink-0 px-8 pb-8 pt-4 bg-white border-t border-gray-50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-[#F1F5F9] text-gray-600 rounded-2xl text-[10px] font-black tracking-widest hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>

            {step === 1 ? (
              <button
                type="button"
                disabled={!selectedCategory}
                onClick={() => setStep(2)}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Continue <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="submit"
                form="accessories-form"
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black tracking-widest shadow-lg shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Save size={14} />
                {accessory
                  ? 'Update Accessory'
                  : items.length > 1
                    ? `Save ${items.length} Accessories`
                    : 'Save Accessory'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

// ─── Step indicator dot ──────────────────────────────────────────────────────
const StepDot: React.FC<{ active: boolean; done: boolean; label: string }> = ({ active, done, label }) => (
  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
    done
      ? 'bg-green-500 text-white'
      : active
        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
        : 'bg-gray-100 text-gray-400'
  }`}>
    {done ? <CheckCircle2 size={12} /> : label}
  </div>
);

// ─── Individual accessory card ───────────────────────────────────────────────
interface CardProps {
  index: number;
  item: AccessoryItem;
  total: number;
  isEdit: boolean;
  onChange: (i: number, field: keyof AccessoryItem, value: string) => void;
  onRemove: () => void;
}

const AccessoryItemCard: React.FC<CardProps> = ({ index, item, total, isEdit, onChange, onRemove }) => (
  <div className="bg-[#F8FAFC] border border-gray-100 p-5 rounded-[1.8rem] space-y-4 relative group">
    {/* Card label + remove */}
    {!isEdit && (
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-blue-500 tracking-widest uppercase">
          Accessory #{index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 text-red-400 hover:bg-red-50 rounded-xl transition-all"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    )}

    {/* Title */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-1.5">
        <Tag size={11} className="text-blue-500" /> Title
      </label>
      <input
        type="text"
        required
        placeholder="e.g. Copper Wire 5m"
        value={item.title}
        onChange={e => onChange(index, 'title', e.target.value)}
        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
      />
    </div>

    {/* Price + Status */}
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-1.5">
          <DollarSign size={11} className="text-blue-500" /> Price (₹)
        </label>
        <input
          type="number"
          required
          min="0"
          placeholder="e.g. 500"
          value={item.price}
          onChange={e => onChange(index, 'price', e.target.value)}
          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-1.5">
          <Activity size={11} className="text-blue-500" /> Status
        </label>
        <select
          value={item.status}
          onChange={e => onChange(index, 'status', e.target.value)}
          className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all appearance-none cursor-pointer"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    {/* Image URL */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-1.5">
        <Palette size={11} className="text-blue-500" /> Image URL
      </label>
      <input
        type="url"
        required
        placeholder="https://example.com/image.jpg"
        value={item.image}
        onChange={e => onChange(index, 'image', e.target.value)}
        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all"
      />
    </div>

    {/* Description */}
    <div className="space-y-1">
      <label className="text-[10px] font-black text-gray-400 tracking-widest ml-1 flex items-center gap-1.5">
        <Wrench size={11} className="text-blue-500" /> Description
      </label>
      <textarea
        required
        placeholder="Describe this accessory..."
        value={item.description}
        onChange={e => onChange(index, 'description', e.target.value)}
        rows={2}
        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-200 transition-all resize-none"
      />
    </div>
  </div>
);

export default AccessoryModal;
