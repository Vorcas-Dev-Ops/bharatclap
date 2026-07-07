"use client";

import React from 'react';
import { GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/utils/geocode';
import { useGoogleMaps } from '@/components/common/GoogleMapsProvider';

interface MapComponentProps {
  locations: any[];
  center?: [number, number];
  zoom?: number;
  highlightId?: string | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};


const MapComponent: React.FC<MapComponentProps> = ({ 
  locations, 
  center = [12.9716, 77.5946], 
  zoom = 11,
  highlightId 
}) => {
  const { isLoaded, loadError } = useGoogleMaps();

  const mapCenter = { lat: center[0], lng: center[1] };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="w-full h-full bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400">Loading Map...</div>;

  return (
    <div className="w-full h-full rounded-[20px] overflow-hidden relative z-0 border border-[#e2e8f0] bg-[#f8fafc]">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={zoom}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {locations.map(loc => {
          if (!loc.latitude || !loc.longitude) return null;
          const isHighlighted = highlightId === loc._id;
          
          return (
            <Marker
              key={loc._id}
              position={{ lat: loc.latitude, lng: loc.longitude }}
              title={loc.name}
              animation={isHighlighted ? google.maps.Animation.BOUNCE : undefined}
            >
              {isHighlighted && (
                <InfoWindow position={{ lat: loc.latitude, lng: loc.longitude }}>
                  <div className="p-1">
                    <div className="font-bold text-[#0f172a] text-[12px]">{loc.name}</div>
                    <div className="text-[10px] text-[#64748b] uppercase font-bold tracking-tight">{loc.type} Node</div>
                  </div>
                </InfoWindow>
              )}
            </Marker>
          );
        })}
      </GoogleMap>
    </div>
  );
};

export default MapComponent;
