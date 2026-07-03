"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";
import { reverseGeocode, GOOGLE_MAPS_API_KEY } from "@/utils/geocode";

interface InteractiveMapPickerProps {
  latitude: number;
  longitude: number;
  onLocationPicked: (data: {
    name: string;
    pincode: string;
    latitude: number;
    longitude: number;
    formattedAddress?: string;
  }) => void;
  parentCityName?: string;
}

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

type Library = "places" | "drawing" | "geometry" | "visualization";
const libraries: Library[] = ["places"];

export default function InteractiveMapPicker({
  latitude,
  longitude,
  onLocationPicked,
  parentCityName,
}: InteractiveMapPickerProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [mapCenter, setMapCenter] = useState({
    lat: latitude || 12.9716,
    lng: longitude || 77.5946,
  });
  
  const [markerPosition, setMarkerPosition] = useState({
    lat: latitude || 12.9716,
    lng: longitude || 77.5946,
  });

  const [isLocating, setIsLocating] = useState(false);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  // Sync external prop changes
  useEffect(() => {
    if (latitude && longitude) {
      const pos = { lat: latitude, lng: longitude };
      setMarkerPosition(pos);
      setMapCenter(pos);
    }
  }, [latitude, longitude]);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    try {
      setIsLocating(true);
      const result = await reverseGeocode(lat, lng);

      const areaName = result.area_locality || result.city || result.house_no_building;

      onLocationPicked({
        name: areaName,
        pincode: result.pincode,
        latitude: lat,
        longitude: lng,
        formattedAddress: result.formatted_address,
      });
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    } finally {
      setIsLocating(false);
    }
  };

  const onMarkerDragEnd = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
    await handleReverseGeocode(lat, lng);
  };

  const onMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPosition({ lat, lng });
    await handleReverseGeocode(lat, lng);
  };

  const onLoadAutocomplete = (autoC: google.maps.places.Autocomplete) => {
    setAutocomplete(autoC);
  };

  const onPlaceChanged = async () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        
        const pos = { lat, lng };
        setMapCenter(pos);
        setMarkerPosition(pos);

        // Instead of manually parsing the place object right away, let's pass it to reverseGeocode for consistency,
        // or just use the geometry.
        await handleReverseGeocode(lat, lng);
      }
    }
  };

  if (loadError) {
    return (
      <div className="w-full h-64 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center text-xs font-bold border border-red-100">
        Error loading Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-64 bg-slate-50 text-slate-400 rounded-[2rem] flex flex-col items-center justify-center text-[10px] font-black uppercase tracking-widest border border-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        Initialising Google Maps...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative z-10 w-full">
        <Autocomplete
          onLoad={onLoadAutocomplete}
          onPlaceChanged={onPlaceChanged}
          options={{
            componentRestrictions: { country: "in" },
            fields: ["geometry", "formatted_address", "name", "address_components"],
          }}
        >
          <div className="relative flex items-center bg-white border border-gray-200/80 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all overflow-hidden">
            <Search size={16} className="absolute left-4 text-gray-400 z-10" />
            <input
              type="text"
              placeholder={
                parentCityName
                  ? `Search in ${parentCityName} (e.g. Shivajinagar)...`
                  : "Search location..."
              }
              className="w-full py-3.5 pl-11 pr-4 text-xs font-bold text-gray-700 placeholder-gray-400 outline-none"
            />
          </div>
        </Autocomplete>
      </div>

      {/* Instructions Rail */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
          <Navigation size={10} className="text-blue-500" />
          Drag marker to adjust location
        </p>
        {isLocating && (
          <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest animate-pulse flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Resolving Address...
          </span>
        )}
      </div>

      {/* Map Element Container */}
      <div className="relative w-full h-64 rounded-[2rem] border border-gray-200 shadow-inner overflow-hidden z-0 bg-[#f8fafc]">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={15}
          onClick={onMapClick}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
            animation={google.maps.Animation.DROP}
          />
        </GoogleMap>
      </div>
    </div>
  );
}
