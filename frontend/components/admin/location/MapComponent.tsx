"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
interface MapComponentProps {
  locations: any[];
  center?: [number, number];
  zoom?: number;
  highlightId?: string | null;
}

// Helper to auto-center map when locations change
const RecenterMap = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const MapComponent: React.FC<MapComponentProps> = ({ 
  locations, 
  center = [12.9716, 77.5946], 
  zoom = 11,
  highlightId 
}) => {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const leafletMap = React.useRef<L.Map | null>(null);
  const markersRef = React.useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Manual Initialization - bypass react-leaflet context sync
    const map = L.map(mapRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Sync Markers
  useEffect(() => {
    if (!leafletMap.current) return;

    // Clear old markers that are no longer present
    const currentIds = new Set(locations.map(l => l._id));
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Update or Add markers
    locations.forEach(loc => {
      if (!loc.latitude || !loc.longitude) return;

      const isHighlighted = highlightId === loc._id;
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative">
            <div class="w-6 h-6 ${isHighlighted ? 'bg-[#2563eb] scale-125' : 'bg-[#2563eb]/80'} rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-all duration-300">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
            ${isHighlighted ? '<div class="absolute -inset-2 bg-[#2563eb]/20 rounded-full animate-ping"></div>' : ''}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (markersRef.current[loc._id]) {
        markersRef.current[loc._id].setIcon(customIcon);
        markersRef.current[loc._id].setLatLng([loc.latitude, loc.longitude]);
      } else {
        const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon })
          .addTo(leafletMap.current!)
          .bindPopup(`
            <div class="font-bold text-[#0f172a] text-[12px]">${loc.name}</div>
            <div class="text-[10px] text-[#64748b] uppercase font-bold tracking-tight">${loc.type} Node</div>
          `);
        markersRef.current[loc._id] = marker;
      }
    });

    if (highlightId && markersRef.current[highlightId]) {
      markersRef.current[highlightId].openPopup();
    }
  }, [locations, highlightId]);

  // Sync Center
  useEffect(() => {
    if (leafletMap.current) {
      leafletMap.current.setView(center, zoom);
    }
  }, [center, zoom]);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full rounded-[20px] overflow-hidden relative z-0 border border-[#e2e8f0] bg-[#f8fafc]"
    />
  );
};

export default MapComponent;
