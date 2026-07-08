"use client";

/**
 * GoogleMapsProvider
 * ------------------
 * Loads the Google Maps JS SDK exactly ONCE for the entire app using
 * LoadScript (the component equivalent of useJsApiLoader).
 *
 * All components that use @react-google-maps/api — MapComponent,
 * InteractiveMapPicker, AddressFormModal — must NOT call useJsApiLoader
 * themselves. Instead, they should call useGoogleMaps() to get isLoaded/loadError.
 *
 * This eliminates the "Loader must not be called again with different options" crash
 * that happens when multiple components call useJsApiLoader with different library sets.
 */

import React, { createContext, useContext, useState } from "react";
import { LoadScript } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY } from "@/utils/geocode";

type Library = "places" | "drawing" | "geometry" | "visualization";

// All libraries needed anywhere in the app — declare once here.
const LIBRARIES: Library[] = ["places"];

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
});

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

export function GoogleMapsProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
      <LoadScript
        googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        libraries={LIBRARIES}
        onLoad={() => setIsLoaded(true)}
        onError={(err) => setLoadError(err)}
        loadingElement={null}
      >
        <></>
      </LoadScript>
    </GoogleMapsContext.Provider>
  );
}
