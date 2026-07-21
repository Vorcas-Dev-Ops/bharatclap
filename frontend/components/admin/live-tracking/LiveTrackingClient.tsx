"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { useGoogleMaps } from '@/components/common/GoogleMapsProvider';
import { apiClient } from '@/config/api';
import { getSocket } from '@/services/socket';
import { 
  Navigation, 
  Search, 
  MapPin, 
  User, 
  Phone, 
  Clock, 
  Activity, 
  UserCheck, 
  AlertCircle
} from 'lucide-react';
import { Spin, Input, Radio, Card, Statistic, Badge } from 'antd';

interface LiveProvider {
  _id: string;
  provider_id: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number;
  speed?: number;
  accuracy?: number;
  isOnline: boolean;
  currentStatus: 'idle' | 'on_job' | 'offline';
  lastUpdatedAt: string;
  name: string;
  phone: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
  borderRadius: '24px',
};

const defaultCenter = {
  lat: 12.9716, // Bangalore default
  lng: 77.5946,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

export default function LiveTrackingClient() {
  const { isLoaded, loadError } = useGoogleMaps();
  const [providers, setProviders] = useState<LiveProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'idle' | 'on_job' | 'offline'>('all');
  const [selectedProvider, setSelectedProvider] = useState<LiveProvider | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const fetchLiveProviders = useCallback(async (attempt = 1) => {
    try {
      const response = await apiClient.get('/providers/admin/live-providers');
      setProviders(response.data || []);
      setLoading(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const isTransient = status === 504 || status === 503 || err?.code === 'ECONNABORTED' || err?.code === 'ERR_NETWORK';
      if (isTransient && attempt < 4) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[LiveTracking] Service unavailable (attempt ${attempt}/4). Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchLiveProviders(attempt + 1), delay);
      } else {
        // ponytail: log message instead of throwing raw AxiosError to prevent Next.js dev overlay on transient outage
        console.warn('[LiveTracking] Failed to load live provider coordinates:', err?.message || err);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchLiveProviders();

    // Set up Socket.IO tracking listener
    const socket = getSocket();
    socket.connect();

    socket.on('provider_location_changed', (data: any) => {
      setProviders(prev => {
        const index = prev.findIndex(p => p.provider_id === data.provider_id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            coordinates: data.coordinates,
            heading: data.heading,
            speed: data.speed,
            accuracy: data.accuracy,
            isOnline: data.currentStatus !== 'offline',
            currentStatus: data.currentStatus,
            lastUpdatedAt: data.lastUpdatedAt,
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              _id: data.provider_id,
              provider_id: data.provider_id,
              coordinates: data.coordinates,
              heading: data.heading,
              speed: data.speed,
              accuracy: data.accuracy,
              isOnline: data.currentStatus !== 'offline',
              currentStatus: data.currentStatus,
              lastUpdatedAt: data.lastUpdatedAt,
              name: data.name,
              phone: data.phone || '',
            },
          ];
        }
      });
    });

    // Mark stale offline updates locally
    const localStaleChecker = setInterval(() => {
      const ninetySecondsAgo = Date.now() - 90000;
      setProviders(prev => {
        return prev.map(p => {
          if (p.isOnline && new Date(p.lastUpdatedAt).getTime() <= ninetySecondsAgo) {
            return { ...p, isOnline: false, currentStatus: 'offline' };
          }
          return p;
        });
      });
    }, 15000);

    return () => {
      socket.off('provider_location_changed');
      clearInterval(localStaleChecker);
    };
  }, [fetchLiveProviders]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleProviderSelect = (provider: LiveProvider) => {
    setSelectedProvider(provider);
    if (mapRef.current) {
      mapRef.current.panTo({
        lat: provider.coordinates[1],
        lng: provider.coordinates[0],
      });
      mapRef.current.setZoom(15);
    }
  };

  // Filter providers
  const filteredProviders = providers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.phone.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || p.currentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalOnline = providers.filter(p => p.currentStatus !== 'offline').length;
  const idleCount = providers.filter(p => p.currentStatus === 'idle').length;
  const onJobCount = providers.filter(p => p.currentStatus === 'on_job').length;
  const offlineCount = providers.filter(p => p.currentStatus === 'offline').length;

  if (loadError) {
    return (
      <div className="p-8 flex items-center justify-center bg-slate-50 rounded-[2rem] border border-red-100 min-h-[400px]">
        <div className="text-center space-y-3">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-black text-slate-800">Map Loading Failed</h3>
          <p className="text-sm font-bold text-slate-400">Please check your Google Maps API configuration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Navigation className="w-7 h-7 text-[#1D2B83] rotate-45" />
            Live Provider Operations Map
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Real-time GPS tracking and assignment status of online technicians
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <Statistic
            title={<span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Online</span>}
            value={totalOnline}
            prefix={<Badge status="processing" />}
            styles={{ content: { fontSize: '28px', fontWeight: '900', color: '#1E293B' } }}
          />
        </Card>
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <Statistic
            title={<span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Idle & Ready</span>}
            value={idleCount}
            prefix={<Badge status="success" />}
            styles={{ content: { fontSize: '28px', fontWeight: '900', color: '#10B981' } }}
          />
        </Card>
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <Statistic
            title={<span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Active on Jobs</span>}
            value={onJobCount}
            prefix={<Badge status="warning" />}
            styles={{ content: { fontSize: '28px', fontWeight: '900', color: '#F59E0B' } }}
          />
        </Card>
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <Statistic
            title={<span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Offline</span>}
            value={offlineCount}
            prefix={<Badge status="default" />}
            styles={{ content: { fontSize: '28px', fontWeight: '900', color: '#64748B' } }}
          />
        </Card>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Sidebar Controls (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            
            {/* Search Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Search Provider</label>
              <Input
                placeholder="Name or Phone..."
                prefix={<Search className="w-4 h-4 text-slate-400" />}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-12 rounded-xl font-bold border-slate-200"
              />
            </div>

            {/* Filter Segment */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Filter Status</label>
              <Radio.Group 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)} 
                className="w-full flex flex-wrap"
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="all" className="flex-1 text-center font-bold text-xs h-10 flex items-center justify-center">All</Radio.Button>
                <Radio.Button value="idle" className="flex-1 text-center font-bold text-xs h-10 flex items-center justify-center">Idle</Radio.Button>
                <Radio.Button value="on_job" className="flex-1 text-center font-bold text-xs h-10 flex items-center justify-center">On Job</Radio.Button>
                <Radio.Button value="offline" className="flex-1 text-center font-bold text-xs h-10 flex items-center justify-center">Offline</Radio.Button>
              </Radio.Group>
            </div>

            {/* Provider List */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Providers ({filteredProviders.length})
              </label>
              
              {loading ? (
                <div className="py-8 text-center"><Spin /></div>
              ) : filteredProviders.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-bold">No providers match criteria</p>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredProviders.map(p => (
                    <button
                      key={p.provider_id}
                      onClick={() => handleProviderSelect(p)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        selectedProvider?.provider_id === p.provider_id
                          ? 'border-[#1D2B83] bg-[#1D2B83]/5 shadow-sm'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-800">{p.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                          <Phone className="w-3 h-3" />
                          <span>{p.phone}</span>
                        </div>
                      </div>
                      <Badge 
                        status={p.currentStatus === 'idle' ? 'success' : p.currentStatus === 'on_job' ? 'warning' : 'default'} 
                        text={<span className="text-[10px] font-black uppercase tracking-wide text-slate-600">{p.currentStatus === 'idle' ? 'Idle' : p.currentStatus === 'on_job' ? 'On Job' : 'Offline'}</span>} 
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Map Panel (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-100 rounded-3xl p-3 shadow-sm overflow-hidden">
          {!isLoaded ? (
            <div className="h-[600px] flex items-center justify-center"><Spin size="large" /></div>
          ) : (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={defaultCenter}
              zoom={12}
              onLoad={onMapLoad}
              options={mapOptions}
            >
              {filteredProviders.map(p => {
                const markerPosition = { lat: p.coordinates[1], lng: p.coordinates[0] };
                
                // Color markers based on status
                const pinColor = p.currentStatus === 'idle' ? '10B981' : p.currentStatus === 'on_job' ? 'F59E0B' : '94A3B8';
                const pinIcon = {
                  url: `https://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|${pinColor}`,
                  scaledSize: new google.maps.Size(26, 40),
                };

                return (
                  <Marker
                    key={p.provider_id}
                    position={markerPosition}
                    icon={pinIcon}
                    onClick={() => handleProviderSelect(p)}
                  />
                );
              })}

              {selectedProvider && (
                <InfoWindow
                  position={{ 
                    lat: selectedProvider.coordinates[1], 
                    lng: selectedProvider.coordinates[0] 
                  }}
                  onCloseClick={() => setSelectedProvider(null)}
                >
                  <div className="p-2 space-y-3 min-w-[200px]">
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <User className="w-4 h-4 text-[#1D2B83]" />
                        {selectedProvider.name}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">{selectedProvider.phone}</p>
                    </div>

                    <div className="space-y-2 text-xs font-bold text-slate-600">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Status:</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${selectedProvider.currentStatus === 'idle' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {selectedProvider.currentStatus === 'idle' ? 'Idle / Available' : 'On Active Job'}
                        </span>
                      </div>

                      {selectedProvider.speed !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">⚡ Speed:</span>
                          <span>{Math.round(selectedProvider.speed * 3.6)} km/h</span>
                        </div>
                      )}

                      {selectedProvider.accuracy !== undefined && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">🎯 GPS Accuracy:</span>
                          <span>±{Math.round(selectedProvider.accuracy)}m</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Updated:</span>
                        <span>{new Date(selectedProvider.lastUpdatedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}
        </div>

      </div>
    </div>
  );
}
