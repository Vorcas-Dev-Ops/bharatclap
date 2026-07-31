"use client";

import React, { useState, useEffect } from "react";
import { 
  MapPin, 
  Search, 
  Power, 
  PauseCircle, 
  PlayCircle, 
  Calendar, 
  Clock, 
  CheckSquare, 
  Square, 
  AlertCircle, 
  Check, 
  X, 
  Sliders, 
  RefreshCw,
  Info
} from "lucide-react";
import { message, Modal, Switch, Rate, Tag, Button, Tooltip } from "antd";
import { apiClient } from "@/config/api";
import ProviderLayout from "@/components/provider/ProviderLayout";

interface ScheduleSlot {
  days_of_week: number[];
  start_time: string;
  end_time: string;
}

interface CapacitySetting {
  mode: 'daily' | 'hourly' | 'weekly' | 'unlimited';
  limit: number;
}

interface ServiceLocationItem {
  _id: string;
  name: string;
  status: 'active' | 'paused' | 'suspended' | 'removed';
  paused_reason?: string;
  paused_until?: string;
  schedules?: ScheduleSlot[];
  capacity?: CapacitySetting;
}

const REASON_OPTIONS = [
  "Vacation / Out of Town",
  "Heavy Traffic Area",
  "Personal / Family Time",
  "Staff Shortage",
  "Low Vehicle Capacity",
  "Weather / Heavy Rain",
  "Other"
];

export default function ServiceAreaManager() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<ServiceLocationItem[]>([]);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  // Pause Modal State (Individual or Bulk)
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [targetLocationIds, setTargetLocationIds] = useState<string[]>([]);
  const [selectedReason, setSelectedReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [pauseDuration, setPauseDuration] = useState<"today" | "tomorrow" | "3days" | "1week" | "custom">("today");
  const [customUntilDate, setCustomUntilDate] = useState("");
  const [updating, setUpdating] = useState(false);

  // Schedule & Capacity Edit Modal State
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<ServiceLocationItem | null>(null);
  const [editSchedules, setEditSchedules] = useState<ScheduleSlot[]>([
    { days_of_week: [1, 2, 3, 4, 5], start_time: "08:00", end_time: "18:00" }
  ]);
  const [editCapacityMode, setEditCapacityMode] = useState<'daily' | 'hourly' | 'weekly' | 'unlimited'>('daily');
  const [editCapacityLimit, setEditCapacityLimit] = useState(8);

  useEffect(() => {
    fetchProviderServiceAreas();
  }, []);

  const fetchProviderServiceAreas = async () => {
    try {
      setLoading(true);
      const userData = localStorage.getItem("user");
      if (!userData) return;
      const user = JSON.parse(userData);

      // Fetch provider profile to get provider ID
      const provRes = await apiClient.get(`/providers/me`);
      const provider = provRes.data;
      if (!provider || !provider._id) return;
      setProviderId(provider._id);

      // Fetch provider services
      const svcRes = await apiClient.get(`/provider-services/${provider._id}`);
      const services = svcRes.data?.data || [];

      // Extract unique locations from all provider services
      const locMap = new Map<string, ServiceLocationItem>();

      for (const svc of services) {
        const rawLocations = svc.location_ids || [];
        const rawServiceLocations = svc.service_locations || [];

        for (const loc of rawLocations) {
          const id = typeof loc === 'object' ? loc._id : loc;
          const name = typeof loc === 'object' ? (loc.name || loc.area_name || 'Area') : 'Area';
          if (!id) continue;

          const setting = rawServiceLocations.find((sl: any) => String(sl.location_id) === String(id));

          locMap.set(String(id), {
            _id: String(id),
            name,
            status: setting?.status || 'active',
            paused_reason: setting?.paused_reason,
            paused_until: setting?.paused_until,
            schedules: setting?.schedules || [],
            capacity: setting?.capacity || { mode: 'daily', limit: 8 }
          });
        }
      }

      setLocations(Array.from(locMap.values()));
    } catch (err) {
      console.error("Failed to load service areas", err);
      messageApi.error("Failed to load your service areas");
    } finally {
      setLoading(false);
    }
  };

  const computePausedUntilDate = (duration: string, customDate: string) => {
    const now = new Date();
    if (duration === "today") {
      now.setHours(23, 59, 59, 999);
      return now.toISOString();
    } else if (duration === "tomorrow") {
      now.setDate(now.getDate() + 1);
      now.setHours(23, 59, 59, 999);
      return now.toISOString();
    } else if (duration === "3days") {
      now.setDate(now.getDate() + 3);
      return now.toISOString();
    } else if (duration === "1week") {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    } else if (duration === "custom" && customDate) {
      return new Date(customDate).toISOString();
    }
    return undefined;
  };

  const handleApplyPause = async () => {
    if (!providerId || targetLocationIds.length === 0) return;
    const finalReason = selectedReason === "Other" ? customReason : selectedReason;
    const until = computePausedUntilDate(pauseDuration, customUntilDate);

    try {
      setUpdating(true);
      for (const locId of targetLocationIds) {
        await apiClient.put('/provider-services/locations/manage', {
          provider_id: providerId,
          location_id: locId,
          status: 'paused',
          paused_reason: finalReason || 'Provider paused',
          paused_until: until,
          correlation_id: `CORR-${Date.now()}-${Math.random().toString(36).substring(7)}`
        });
      }

      messageApi.success(`Paused ${targetLocationIds.length} service area(s)`);
      setPauseModalOpen(false);
      setSelectedLocationIds([]);
      fetchProviderServiceAreas();
    } catch (err) {
      console.error("Failed to pause area(s)", err);
      messageApi.error("Failed to update area status");
    } finally {
      setUpdating(false);
    }
  };

  const handleResumeLocations = async (locIds: string[]) => {
    if (!providerId || locIds.length === 0) return;
    try {
      setLoading(true);
      for (const locId of locIds) {
        await apiClient.put('/provider-services/locations/manage', {
          provider_id: providerId,
          location_id: locId,
          status: 'active',
          correlation_id: `CORR-${Date.now()}-${Math.random().toString(36).substring(7)}`
        });
      }
      messageApi.success(`Resumed ${locIds.length} service area(s)`);
      setSelectedLocationIds([]);
      fetchProviderServiceAreas();
    } catch (err) {
      console.error("Failed to resume area(s)", err);
      messageApi.error("Failed to resume area status");
      setLoading(false);
    }
  };

  const handleSaveScheduleAndCapacity = async () => {
    if (!providerId || !editingLocation) return;
    try {
      setUpdating(true);
      await apiClient.put('/provider-services/locations/manage', {
        provider_id: providerId,
        location_id: editingLocation._id,
        status: editingLocation.status,
        schedules: editSchedules,
        capacity: { mode: editCapacityMode, limit: editCapacityLimit },
        correlation_id: `CORR-${Date.now()}-${Math.random().toString(36).substring(7)}`
      });

      messageApi.success("Schedule & Capacity settings saved!");
      setScheduleModalOpen(false);
      setEditingLocation(null);
      fetchProviderServiceAreas();
    } catch (err) {
      console.error("Failed to save schedule", err);
      messageApi.error("Failed to save schedule settings");
    } finally {
      setUpdating(false);
    }
  };

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = locations.filter(l => l.status === 'active').length;
  const pausedCount = locations.filter(l => l.status === 'paused').length;
  const suspendedCount = locations.filter(l => l.status === 'suspended').length;

  const isAllSelected = filteredLocations.length > 0 && selectedLocationIds.length === filteredLocations.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedLocationIds([]);
    } else {
      setSelectedLocationIds(filteredLocations.map(l => l._id));
    }
  };

  const toggleSelectLocation = (id: string) => {
    if (selectedLocationIds.includes(id)) {
      setSelectedLocationIds(selectedLocationIds.filter(i => i !== id));
    } else {
      setSelectedLocationIds([...selectedLocationIds, id]);
    }
  };

  return (
    <ProviderLayout>
      {contextHolder}
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <MapPin className="text-blue-600" size={28} /> My Service Areas
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Manage operating neighborhoods, pause work temporarily, set weekly schedules, and daily job limits.
            </p>
          </div>

          <Button 
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />} 
            onClick={fetchProviderServiceAreas}
            className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10 shadow-sm"
          >
            Refresh
          </Button>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xl">
              {locations.length}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Registered</p>
              <p className="text-lg font-black text-slate-900">Service Areas</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-xl">
              {activeCount}
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active & Eligible</p>
              <p className="text-lg font-black text-slate-900">Receiving Jobs</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xl">
              {pausedCount}
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Temporarily Paused</p>
              <p className="text-lg font-black text-slate-900">Provider Off</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xl">
              {suspendedCount}
            </div>
            <div>
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Admin Suspended</p>
              <p className="text-lg font-black text-slate-900">Locked Areas</p>
            </div>
          </div>
        </div>

        {/* Action & Filter Controls Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search registered areas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:border-blue-600 outline-none transition-all"
              />
            </div>

            {/* Bulk Selection Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {isAllSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
              </button>

              {selectedLocationIds.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      setTargetLocationIds(selectedLocationIds);
                      setPauseModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <PauseCircle size={15} />
                    <span>Pause ({selectedLocationIds.length})</span>
                  </button>

                  <button
                    onClick={() => handleResumeLocations(selectedLocationIds)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <PlayCircle size={15} />
                    <span>Resume ({selectedLocationIds.length})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Service Locations Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 animate-pulse space-y-4">
                <div className="h-6 bg-slate-100 rounded w-1/2" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-10 bg-slate-100 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : filteredLocations.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
            <MapPin className="mx-auto text-slate-300" size={48} />
            <h3 className="text-base font-black text-slate-700">No Service Areas Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              You have not registered for any service locations matching your filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLocations.map(loc => {
              const isSelected = selectedLocationIds.includes(loc._id);
              const isActive = loc.status === 'active';
              const isPaused = loc.status === 'paused';
              const isSuspended = loc.status === 'suspended';

              return (
                <div
                  key={loc._id}
                  className={`bg-white rounded-3xl p-6 border transition-all relative space-y-5 shadow-sm ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelectLocation(loc._id)}
                        className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                      </button>

                      <div>
                        <h3 className="font-black text-slate-900 text-base">{loc.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                            </span>
                          )}
                          {isPaused && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-extrabold uppercase tracking-wider">
                              <PauseCircle size={11} /> Paused
                            </span>
                          )}
                          {isSuspended && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-extrabold uppercase tracking-wider">
                              <AlertCircle size={11} /> Suspended
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <Switch
                      checked={isActive}
                      disabled={isSuspended}
                      onChange={(checked) => {
                        if (!checked) {
                          setTargetLocationIds([loc._id]);
                          setPauseModalOpen(true);
                        } else {
                          handleResumeLocations([loc._id]);
                        }
                      }}
                    />
                  </div>

                  {/* Paused Details Box */}
                  {isPaused && (
                    <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-[11px] space-y-1">
                      <p className="font-bold text-amber-900">
                        Reason: <span className="font-medium text-amber-800">{loc.paused_reason || 'Personal'}</span>
                      </p>
                      {loc.paused_until && (
                        <p className="text-amber-700 font-semibold flex items-center gap-1">
                          <Clock size={12} /> Resumes: {new Date(loc.paused_until).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Schedule & Capacity Info */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-slate-400" />
                      <span>{loc.schedules && loc.schedules.length > 0 ? `${loc.schedules.length} Shift Slot(s)` : 'All Day'}</span>
                    </div>

                    <button
                      onClick={() => {
                        setEditingLocation(loc);
                        setEditSchedules(loc.schedules && loc.schedules.length > 0 ? loc.schedules : [
                          { days_of_week: [1, 2, 3, 4, 5], start_time: "08:00", end_time: "18:00" }
                        ]);
                        setEditCapacityMode(loc.capacity?.mode || 'daily');
                        setEditCapacityLimit(loc.capacity?.limit || 8);
                        setScheduleModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider cursor-pointer"
                    >
                      <Sliders size={12} /> Schedule & Limits
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

        {/* Pause Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-slate-900">
              <PauseCircle className="text-amber-500" size={20} />
              <span className="font-black uppercase tracking-tight">Pause Service Area(s)</span>
            </div>
          }
          open={pauseModalOpen}
          onCancel={() => setPauseModalOpen(false)}
          footer={[
            <Button 
              key="cancel" 
              onClick={() => setPauseModalOpen(false)}
              className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10"
            >
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={updating}
              onClick={handleApplyPause}
              className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10 bg-amber-500 hover:bg-amber-600 border-none text-slate-950"
            >
              Confirm Pause
            </Button>
          ]}
          centered
          className="premium-modal"
        >
          <div className="py-4 space-y-5">
            <p className="text-xs font-semibold text-slate-500 leading-relaxed">
              Pausing service areas temporarily stops new job dispatches for the selected neighborhoods. You can unpause anytime.
            </p>

            {/* Select Reason */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Select Pause Reason</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:border-blue-600 outline-none transition-all"
              >
                {REASON_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>

              {selectedReason === "Other" && (
                <input
                  type="text"
                  placeholder="Specify custom reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full mt-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:border-blue-600 outline-none transition-all"
                />
              )}
            </div>

            {/* Select Duration */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Select Pause Duration</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: "today", label: "Until Tonight (Midnight)" },
                  { key: "tomorrow", label: "Until Tomorrow Night" },
                  { key: "3days", label: "3 Days" },
                  { key: "1week", label: "1 Week" },
                ].map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPauseDuration(item.key as any)}
                    className={`p-3 rounded-2xl border text-left font-bold transition-all cursor-pointer ${
                      pauseDuration === item.key ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>

        {/* Schedule & Capacity Edit Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2 text-slate-900">
              <Sliders className="text-blue-600" size={20} />
              <span className="font-black uppercase tracking-tight">Set Schedule & Limits - {editingLocation?.name}</span>
            </div>
          }
          open={scheduleModalOpen}
          onCancel={() => setScheduleModalOpen(false)}
          footer={[
            <Button key="cancel" onClick={() => setScheduleModalOpen(false)} className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10">
              Cancel
            </Button>,
            <Button
              key="save"
              type="primary"
              loading={updating}
              onClick={handleSaveScheduleAndCapacity}
              className="rounded-xl font-bold uppercase text-[10px] tracking-wider h-10 bg-blue-600 border-none px-6"
            >
              Save Settings
            </Button>
          ]}
          centered
          width={550}
          className="premium-modal"
        >
          <div className="py-4 space-y-6">
            
            {/* Shifts & Time Slots */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Weekly Operating Hours</label>
              {editSchedules.map((slot, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Shift Slot #{idx + 1}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Start Time</span>
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) => {
                          const updated = [...editSchedules];
                          updated[idx].start_time = e.target.value;
                          setEditSchedules(updated);
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>

                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">End Time</span>
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) => {
                          const updated = [...editSchedules];
                          updated[idx].end_time = e.target.value;
                          setEditSchedules(updated);
                        }}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Daily Capacity Limits */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Daily Booking Limit</label>
              <div className="flex items-center gap-4">
                <select
                  value={editCapacityMode}
                  onChange={(e) => setEditCapacityMode(e.target.value as any)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium outline-none"
                >
                  <option value="daily">Daily Max Capacity</option>
                  <option value="hourly">Hourly Max Capacity</option>
                  <option value="unlimited">Unlimited (No Limit)</option>
                </select>

                {editCapacityMode !== 'unlimited' && (
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editCapacityLimit}
                    onChange={(e) => setEditCapacityLimit(Number(e.target.value))}
                    className="w-28 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black outline-none text-center"
                  />
                )}
              </div>
            </div>

          </div>
        </Modal>

      </div>
    </ProviderLayout>
  );
}
