export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export interface GeocodeResult {
  house_no_building: string;
  address_line_1: string;
  area_locality: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  formatted_address: string;
  place_id: string;
  latitude: number;
  longitude: number;
  
  // Legacy fields to not break other components right away, we will fall back
  house_name?: string;
  street?: string;
  area?: string;
  display_name?: string;
}

/**
 * Free, zero-billing fallback geocoding via OpenStreetMap (Nominatim).
 * Used when Google Maps API key is missing or has BillingNotEnabledMapError.
 */
async function reverseGeocodeOSM(lat: number, lng: number): Promise<GeocodeResult> {
  // 1. Try BigDataCloud Client API (browser-friendly, zero CORS restrictions, no billing required)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const bdcRes = await fetch(bdcUrl);
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const area = bdcData.locality || bdcData.principalSubdivision || "";
      const city = bdcData.city || bdcData.locality || "Bengaluru";
      const state = bdcData.principalSubdivision || "Karnataka";
      const country = bdcData.countryName || "India";
      const pincode = bdcData.postcode || "";
      const formatted_address = [area, city, state, pincode].filter(Boolean).join(", ");

      return {
        house_no_building: "",
        address_line_1: area,
        area_locality: area,
        city,
        district: city,
        state,
        country,
        pincode,
        formatted_address,
        place_id: `bdc-${lat}-${lng}`,
        latitude: lat,
        longitude: lng,
        house_name: "",
        street: area,
        area,
        display_name: formatted_address,
      };
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback to OpenStreetMap without forbidden User-Agent header
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};

      const area_locality =
        addr.suburb ||
        addr.neighbourhood ||
        addr.residential ||
        addr.subdistrict ||
        addr.quarter ||
        addr.city_district ||
        "";
      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.village ||
        addr.state_district ||
        "Bengaluru";
      const state = addr.state || "Karnataka";
      const pincode = addr.postcode || "";
      const road = addr.road || "";
      const house_no_building = addr.house_number || addr.building || "";
      const formatted_address =
        data.display_name ||
        [house_no_building, road, area_locality, city, state, pincode]
          .filter(Boolean)
          .join(", ");

      return {
        house_no_building,
        address_line_1: road,
        area_locality,
        city,
        district: addr.state_district || city,
        state,
        country: addr.country || "India",
        pincode,
        formatted_address,
        place_id: data.place_id ? String(data.place_id) : `osm-${lat}-${lng}`,
        latitude: lat,
        longitude: lng,
        house_name: house_no_building,
        street: road,
        area: area_locality,
        display_name: formatted_address,
      };
    }
  } catch {
    // Continue to final fallback
  }

  // 3. Fallback default
  return {
    house_no_building: "",
    address_line_1: "",
    area_locality: "Live Area",
    city: "Bengaluru",
    district: "Bengaluru",
    state: "Karnataka",
    country: "India",
    pincode: "",
    formatted_address: "Bengaluru, Karnataka",
    place_id: `fallback-${lat}-${lng}`,
    latitude: lat,
    longitude: lng,
    house_name: "",
    street: "",
    area: "Live Area",
    display_name: "Bengaluru, Karnataka",
  };
}

export const reverseGeocode = async (lat: number, lng: number): Promise<GeocodeResult> => {
  // 1. Attempt Google Maps Reverse Geocode if key is provided
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === "OK" && data.results?.length) {
        const result = data.results[0];
        const place_id = result.place_id;
        const formatted_address = result.formatted_address;
        const location = result.geometry.location;

        const getComponent = (types: string[]) => {
          const comp = result.address_components.find((c: any) =>
            types.some((t) => c.types.includes(t))
          );
          return comp ? comp.long_name : "";
        };

        const house_no_building =
          getComponent(["street_number", "premise", "point_of_interest"]) || "";
        const address_line_1 = getComponent(["route"]) || "";
        const area_locality =
          getComponent(["sublocality", "neighborhood"]) || "";
        const city = getComponent(["locality"]) || "";
        const district =
          getComponent(["administrative_area_level_2"]) || city;
        const state = getComponent(["administrative_area_level_1"]) || "";
        const country = getComponent(["country"]) || "India";
        const pincode = getComponent(["postal_code"]) || "";

        return {
          house_no_building,
          address_line_1,
          area_locality,
          city,
          district,
          state,
          country,
          pincode,
          formatted_address,
          place_id,
          latitude: location.lat,
          longitude: location.lng,
          house_name: house_no_building,
          street: address_line_1,
          area: area_locality,
          display_name: formatted_address,
        };
      }
    } catch (googleErr) {
      console.warn("Google Maps reverse geocode failed, falling back to OpenStreetMap:", googleErr);
    }
  }

  // 2. Fall back to free OpenStreetMap Nominatim
  try {
    return await reverseGeocodeOSM(lat, lng);
  } catch (osmErr) {
    console.warn("OSM geocode failed, using coordinate fallback:", osmErr);
    // 3. Fallback coordinates object so user flow is never interrupted
    return {
      house_no_building: "",
      address_line_1: "",
      area_locality: "Bengaluru",
      city: "Bengaluru",
      district: "Bengaluru Urban",
      state: "Karnataka",
      country: "India",
      pincode: "",
      formatted_address: `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)} (Bengaluru)`,
      place_id: `coord-${lat}-${lng}`,
      latitude: lat,
      longitude: lng,
      house_name: "",
      street: "",
      area: "Bengaluru",
      display_name: "Bengaluru, Karnataka",
    };
  }
};
