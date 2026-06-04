"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, MapPin, Loader2, Navigation } from "lucide-react";

interface InteractiveMapPickerProps {
  latitude: number;
  longitude: number;
  onLocationPicked: (data: {
    name: string;
    pincode: string;
    latitude: number;
    longitude: number;
  }) => void;
  parentCityName?: string; // Optional: to restrict search/zoom context
}

const InteractiveMapPicker: React.FC<InteractiveMapPickerProps> = ({
  latitude,
  longitude,
  onLocationPicked,
  parentCityName,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Initialize raw Leaflet Map to prevent react-leaflet SSR/version issues
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Use current coords or default to Bangalore
    const initialCenter: [number, number] = [
      latitude || 12.9716,
      longitude || 77.5946,
    ];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Custom Blue Pin Icon
    const customIcon = L.divIcon({
      className: "custom-map-picker-pin",
      html: `
        <div class="relative">
          <div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <div class="absolute -inset-1 bg-blue-600/20 rounded-full -z-10 animate-ping"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker(initialCenter, { icon: customIcon }).addTo(map);

    mapInstanceRef.current = map;
    markerInstanceRef.current = marker;

    // Map Click Handler for Reverse Geocoding
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      await handleReverseGeocode(lat, lng);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerInstanceRef.current = null;
    };
  }, []);

  // Update marker position if props change externally
  useEffect(() => {
    if (mapInstanceRef.current && markerInstanceRef.current && latitude && longitude) {
      const newPos: [number, number] = [latitude, longitude];
      markerInstanceRef.current.setLatLng(newPos);
      mapInstanceRef.current.setView(newPos, mapInstanceRef.current.getZoom());
    }
  }, [latitude, longitude]);

  // Parse location address details to pick the most relevant area name
  const extractAreaName = (address: any, displayName: string) => {
    if (!address) return displayName.split(",")[0];
    return (
      address.suburb ||
      address.neighbourhood ||
      address.quarter ||
      address.residential ||
      address.road ||
      address.town ||
      address.village ||
      address.city_district ||
      displayName.split(",")[0]
    );
  };

  // Perform Reverse Geocoding via Nominatim
  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      setIsLocating(true);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data && data.address) {
        const areaName = extractAreaName(data.address, data.display_name);
        const pincode = data.address.postcode || "";

        onLocationPicked({
          name: areaName,
          pincode: pincode,
          latitude: lat,
          longitude: lng,
        });

        // Set search bar to display the name
        setSearchQuery(data.display_name);
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    } finally {
      setIsLocating(false);
    }
  };

  // Search Address using Nominatim
  const handleSearch = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      let query = searchQuery;
      // Restrict to parent city context if available
      if (parentCityName && !query.toLowerCase().includes(parentCityName.toLowerCase())) {
        query += `, ${parentCityName}`;
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle click on a search result
  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (mapInstanceRef.current && markerInstanceRef.current) {
      const pos: [number, number] = [lat, lng];
      markerInstanceRef.current.setLatLng(pos);
      mapInstanceRef.current.flyTo(pos, 16);

      const areaName = extractAreaName(result.address, result.display_name);
      const pincode = result.address?.postcode || "";

      onLocationPicked({
        name: areaName,
        pincode: pincode,
        latitude: lat,
        longitude: lng,
      });

      setSearchQuery(result.display_name);
      setSearchResults([]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Control Search Bar */}
      <div className="relative z-[1000] w-full">
        <div className="relative flex items-center bg-white border border-gray-200/80 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all overflow-hidden">
          <Search size={16} className="absolute left-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch(e);
              }
            }}
            placeholder={
              parentCityName
                ? `Search in ${parentCityName} (e.g. Shivajinagar)...`
                : "Search location on map..."
            }
            className="w-full py-3.5 pl-11 pr-24 text-xs font-bold text-gray-700 placeholder-gray-400 outline-none"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {isSearching ? (
              <Loader2 size={14} className="animate-spin text-blue-500" />
            ) : (
              <button
                type="button"
                onClick={() => handleSearch()}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                Search
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Search Results */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar z-[1001] animate-in fade-in slide-in-from-top-1">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectResult(result)}
                className="w-full px-5 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
              >
                <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-gray-800 line-clamp-1">
                    {extractAreaName(result.address, result.display_name)}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-0.5">
                    {result.display_name}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Instructions Rail */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Navigation size={10} className="text-blue-500" />
          Click Map or Search to auto-fill form
        </p>
        {isLocating && (
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Resolving Spatial details...
          </span>
        )}
      </div>

      {/* Map Element Container */}
      <div className="relative w-full h-64 rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden z-10 bg-[#f8fafc]">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default InteractiveMapPicker;
