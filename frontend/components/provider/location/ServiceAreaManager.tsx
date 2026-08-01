"use client";

import React, { useState, useEffect } from "react";
import {
  MapPin,
  Building2,
  Navigation,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  ArrowRight,
  ShieldCheck,
  Radio,
  FileText,
  XCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { App, Modal, Select, Input, Button, Tag } from "antd";
import { apiClient } from "@/config/api";

const { TextArea } = Input;

export default function ServiceAreaManager() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [providerData, setProviderData] = useState<any>(null);
  const [registeredArea, setRegisteredArea] = useState<{ _id?: string; name: string; city: string }>({
    name: "Loading...",
    city: "..."
  });

  // Relocation Change Request State
  const [relocationRequest, setRelocationRequest] = useState<any | null>(null);
  const [relocateModalOpen, setRelocateModalOpen] = useState(false);
  const [masterLocations, setMasterLocations] = useState<any[]>([]);
  const [fetchingMaster, setFetchingMaster] = useState(false);
  const [selectedTargetLoc, setSelectedTargetLoc] = useState<any | null>(null);
  const [relocateReason, setRelocateReason] = useState("");
  const [submittingRelocate, setSubmittingRelocate] = useState(false);

  // Live GPS Tracking State
  const [liveGpsArea, setLiveGpsArea] = useState<string>("Live Location");
  const [liveDistanceKm, setLiveDistanceKm] = useState<number>(0.0);
  const [lastUpdatedSec, setLastUpdatedSec] = useState<number>(0);

  useEffect(() => {
    fetchLocationData();

    // Listen to live GPS location updates broadcasted by background service / navbar
    const handleLocationUpdate = (e: any) => {
      if (e.detail?.area) setLiveGpsArea(e.detail.area);
      if (typeof e.detail?.distanceKm === 'number') setLiveDistanceKm(e.detail.distanceKm);
      setLastUpdatedSec(0);
    };

    window.addEventListener('providerLocationUpdated', handleLocationUpdate);
    const timer = setInterval(() => {
      setLastUpdatedSec(prev => prev + 1);
    }, 1000);

    return () => {
      window.removeEventListener('providerLocationUpdated', handleLocationUpdate);
      clearInterval(timer);
    };
  }, []);

  const fetchLocationData = async () => {
    try {
      setLoading(true);
      const provRes = await apiClient.get('/providers/me');
      const provider = provRes.data;

      if (provider) {
        setProviderData(provider);
        const city = provider.city || provider.primary_city || provider.user_id?.city || provider.address?.city || "Not Specified";
        
        let primaryLocName = provider.primary_location || provider.area || provider.registered_location?.name;
        let primaryLocId = provider.registered_location?._id;

        // Try extracting from service_locations or provider services if primary location string is not set
        if (!primaryLocName && provider._id) {
          try {
            const [svcRes, masterRes] = await Promise.all([
              apiClient.get(`/provider-services/${provider._id}`),
              apiClient.get('/locations')
            ]);
            const services = svcRes.data?.data || [];
            const masterLocs = Array.isArray(masterRes.data) ? masterRes.data : (masterRes.data?.data || []);
            const locMap = new Map(masterLocs.map((l: any) => [String(l._id), l]));

            for (const svc of services) {
              const rawLocs = svc.location_ids || [];
              for (const loc of rawLocs) {
                const locId = typeof loc === 'object' ? loc._id : loc;
                const locObj = typeof loc === 'object' ? loc : locMap.get(String(locId));
                if (locObj) {
                  primaryLocName = locObj.name || locObj.area_name;
                  primaryLocId = locObj._id;
                  break;
                }
              }
              if (primaryLocName) break;
            }
          } catch (err) {
            console.warn("Could not resolve service locations map", err);
          }
        }

        setRegisteredArea({
          _id: primaryLocId,
          name: primaryLocName || "Not Assigned",
          city: city
        });
      }

      // Fetch pending / latest relocation request
      try {
        const changeRes = await apiClient.get('/provider-services/locations/my-change-request');
        if (changeRes.data?.data) {
          setRelocationRequest(changeRes.data.data);
        }
      } catch (err) {
        // No request or endpoint returned 404
      }
    } catch (err) {
      console.error("Failed to load provider location data", err);
      message.error("Failed to load location details");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRelocateModal = async () => {
    setRelocateModalOpen(true);
    setSelectedTargetLoc(null);
    setRelocateReason("");
    try {
      setFetchingMaster(true);
      const res = await apiClient.get('/locations');
      const allLocs = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setMasterLocations(allLocs);
    } catch (err) {
      console.warn("Failed to load master locations", err);
      // Fallback master list if backend is offline
      setMasterLocations([
        { _id: 'loc_shivajinagar', name: 'Shivajinagar', city: registeredArea.city },
        { _id: 'loc_indiranagar', name: 'Indiranagar', city: registeredArea.city },
        { _id: 'loc_koramangala', name: 'Koramangala', city: registeredArea.city },
        { _id: 'loc_whitefield', name: 'Whitefield', city: registeredArea.city },
        { _id: 'loc_hsr', name: 'HSR Layout', city: registeredArea.city },
        { _id: 'loc_yelahanka', name: 'Yelahanka', city: registeredArea.city }
      ]);
    } finally {
      setFetchingMaster(false);
    }
  };

  const handleSubmitRelocationRequest = async () => {
    if (!selectedTargetLoc || !relocateReason.trim()) {
      message.error("Please select a new location and specify the reason for relocation.");
      return;
    }

    try {
      setSubmittingRelocate(true);
      const res = await apiClient.post('/provider-services/locations/request-change', {
        current_location_id: registeredArea._id,
        current_location_name: registeredArea.name,
        requested_location_id: selectedTargetLoc._id,
        requested_location_name: selectedTargetLoc.name,
        reason: relocateReason
      });

      message.success("Location change request submitted for Admin approval!");
      setRelocateModalOpen(false);
      if (res.data?.data) {
        setRelocationRequest(res.data.data);
      } else {
        fetchLocationData();
      }
    } catch (err: any) {
      console.error("Failed to submit location change request", err);
      message.error(err.response?.data?.message || "Failed to submit location change request");
    } finally {
      setSubmittingRelocate(false);
    }
  };

  const isPendingRequest = relocationRequest && relocationRequest.status === 'pending';

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-xs">
              <MapPin size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                My Operating Location
              </h1>
              <p className="text-sm font-medium text-slate-500 mt-0.5">
                Your primary registered operating base and real-time GPS tracking status.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchLocationData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh Status
        </button>
      </div>

      {/* Main Location Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: 📌 Registered Operating Location */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-2xl -z-10 group-hover:bg-blue-100/50 transition-colors" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-black shadow-2xs">
                📌
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Assigned Area</span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Registered Location</h3>
              </div>
            </div>

            {registeredArea.name !== "Not Assigned" && registeredArea.name !== "Loading..." ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-black uppercase tracking-wider shadow-2xs">
                <ShieldCheck size={14} className="text-emerald-600" /> Approved by Admin
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-black uppercase tracking-wider shadow-2xs">
                <AlertCircle size={14} className="text-amber-600" /> Pending Admin Assignment
              </span>
            )}
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">City</span>
              <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Building2 size={16} className="text-blue-500" />
                {registeredArea.city}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Assigned Area</span>
              <span className="text-base font-black text-blue-600 flex items-center gap-1.5">
                📍 {registeredArea.name}
              </span>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-500 leading-relaxed bg-blue-50/50 p-3.5 rounded-xl border border-blue-100/60 text-slate-600">
            🔒 <strong>Fixed Location:</strong> Assigned by Admin during onboarding. Job requests in and around this area are dispatched to you.
          </p>
        </div>

        {/* Card 2: 🟢 Current Live GPS Location */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs space-y-6 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-full blur-2xl -z-10 group-hover:bg-emerald-100/50 transition-colors" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-black shadow-2xs">
                🟢
              </span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Real-Time</span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Current Live Location</h3>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-2xs ${
              providerData?.availability_status === 'available'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                providerData?.availability_status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`} />
              {providerData?.availability_status === 'available' ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Detected Area</span>
              <span className="text-base font-black text-emerald-600 flex items-center gap-1.5">
                <Navigation size={16} className="text-emerald-500" />
                {liveGpsArea}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Distance from Base</span>
              <span className="text-sm font-black text-slate-900">
                {liveDistanceKm > 0 ? `${liveDistanceKm} km` : "Within Area"}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100/60">
            <span className="flex items-center gap-1.5 text-slate-700">
              <Clock size={14} className="text-emerald-600" />
              GPS Last Ping:
            </span>
            <span className="font-black text-slate-900">
              {lastUpdatedSec < 5 ? "Just now" : `${lastUpdatedSec} sec ago`}
            </span>
          </div>
        </div>
      </div>

      {/* Relocation Request Status Alert Banner (If Any Active Request Exists) */}
      {relocationRequest && (
        <div className={`p-6 rounded-3xl border shadow-xs space-y-3 ${
          relocationRequest.status === 'pending'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : relocationRequest.status === 'approved'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : 'bg-rose-50/70 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {relocationRequest.status === 'pending' && <Clock size={20} className="text-amber-600 animate-pulse" />}
              {relocationRequest.status === 'approved' && <CheckCircle2 size={20} className="text-emerald-600" />}
              {relocationRequest.status === 'rejected' && <XCircle size={20} className="text-rose-600" />}
              <h3 className="text-base font-black uppercase tracking-tight">
                Location Change Request: {relocationRequest.status}
              </h3>
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-white/80 shadow-2xs">
              Submitted {new Date(relocationRequest.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>

          <div className="text-sm space-y-1 font-medium pl-8">
            <p>
              Requested Relocation to: <strong className="font-black underline">{relocationRequest.requested_location_name}</strong>
            </p>
            {relocationRequest.reason && (
              <p className="text-xs opacity-80">Reason: "{relocationRequest.reason}"</p>
            )}
            {relocationRequest.admin_response && (
              <p className="text-xs font-bold mt-1">Admin Response: "{relocationRequest.admin_response}"</p>
            )}
          </div>
        </div>
      )}

      {/* Relocation Action Box */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-xl space-y-6 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-black uppercase tracking-widest">
              <Sparkles size={12} /> Need to relocate permanently?
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Request Operating Location Change
            </h2>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              If you have moved permanently or need to switch your primary service neighborhood, you can submit a relocation request to Admin for review.
            </p>
          </div>

          <button
            onClick={handleOpenRelocateModal}
            disabled={isPendingRequest}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 shrink-0 flex items-center justify-center gap-2"
          >
            <Send size={16} />
            {isPendingRequest ? "Request Pending Admin Review" : "Request Location Change"}
          </button>
        </div>
      </div>

      {/* Relocation Change Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-900 font-black text-lg pb-2 border-b border-slate-100">
            <MapPin className="text-blue-600" size={20} />
            Request Location Change
          </div>
        }
        open={relocateModalOpen}
        onCancel={() => setRelocateModalOpen(false)}
        footer={null}
        destroyOnHidden
        centered
        className="rounded-3xl overflow-hidden"
      >
        <div className="space-y-5 pt-3">
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Current Registered Location
            </label>
            <div className="p-3 bg-slate-100 rounded-xl text-slate-800 text-sm font-bold flex items-center gap-2">
              📍 {registeredArea.name} ({registeredArea.city})
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Select New Requested Location *
            </label>
            <Select
              className="w-full h-11"
              placeholder="Search and select new area..."
              loading={fetchingMaster}
              showSearch
              optionFilterProp="children"
              onChange={(_, option: any) => setSelectedTargetLoc(option.locData)}
              options={masterLocations.map(loc => ({
                label: `${loc.name} (${loc.city || registeredArea.city})`,
                value: loc._id,
                locData: loc
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Relocation *
            </label>
            <TextArea
              rows={3}
              placeholder="Explain why you need to relocate (e.g. Moved home, shifted base, closer to customers)..."
              value={relocateReason}
              onChange={(e) => setRelocateReason(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              onClick={() => setRelocateModalOpen(false)}
              className="rounded-xl font-bold border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="primary"
              loading={submittingRelocate}
              onClick={handleSubmitRelocationRequest}
              className="bg-blue-600 hover:bg-blue-500 font-extrabold rounded-xl h-10 px-5 uppercase text-xs tracking-wider"
            >
              Submit Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
