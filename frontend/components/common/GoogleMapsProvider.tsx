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
 * Handles BillingNotEnabledMapError and gm_authFailure gracefully so the application
 * switches smoothly to GPS and OpenStreetMap reverse geocoding without crashing.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
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

  useEffect(() => {
    // Intercept Google Maps authentication/billing failure (BillingNotEnabledMapError)
    if (typeof window !== "undefined") {
      const prevAuthFailure = (window as any).gm_authFailure;
      (window as any).gm_authFailure = () => {
        console.warn(
          "Google Maps API billing is not active (BillingNotEnabledMapError). Falling back to GPS & OpenStreetMap."
        );
        setLoadError(new Error("BillingNotEnabledMapError"));
        if (typeof prevAuthFailure === "function") {
          prevAuthFailure();
        }
      };
    }
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
      {GOOGLE_MAPS_API_KEY ? (
        <LoadScript
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
          libraries={LIBRARIES}
          onLoad={() => setIsLoaded(true)}
          onError={(err) => setLoadError(err)}
          loadingElement={null}
        >
          <></>
        </LoadScript>
      ) : null}
    </GoogleMapsContext.Provider>
  );
}
