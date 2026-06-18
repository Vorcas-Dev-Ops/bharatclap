export const APILAYER_API_KEY = process.env.NEXT_PUBLIC_APILAYER_API_KEY || "";
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export interface GeocodeResult {
  house_name: string;
  street: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  display_name: string;
}

export const reverseGeocode = async (lat: number, lng: number): Promise<GeocodeResult> => {

  // ── Priority 1: APILayer Geocoding API ────────────────────────────────────
  if (APILAYER_API_KEY) {
    try {
      const response = await fetch(
        `https://api.apilayer.com/geocoding/reverse?lat=${lat}&lon=${lng}`,
        {
          headers: {
            apikey: APILAYER_API_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`APILayer responded with status: ${response.status}`);
      }

      const data = await response.json();

      // APILayer returns results array; take the first (most relevant) result
      const result = data?.results?.[0];
      if (!result) throw new Error("No results from APILayer");

      const comp = result.components || {};

      // Indian address fields from APILayer components
      const house_name =
        comp.house_number ||
        comp.building ||
        comp.amenity ||
        comp.tourism ||
        comp.shop ||
        comp.office ||
        "";

      const street = comp.road || comp.pedestrian || comp.footway || "";

      const area =
        comp.neighbourhood ||
        comp.suburb ||
        comp.residential ||
        comp.quarter ||
        "";

      const city =
        comp.city ||
        comp.town ||
        comp.village ||
        comp.county ||
        comp.state_district ||
        "";

      const state = comp.state || comp.state_code || "";
      const pincode = comp.postcode || "";

      return {
        house_name: house_name || result.formatted?.split(",")[0] || "Detected Location",
        street,
        area: area || city,
        city,
        state,
        pincode,
        display_name: result.formatted || `${city}, ${state}`,
      };
    } catch (err) {
      console.warn("APILayer geocoding failed, falling back to Nominatim:", err);
      // Fall through to Nominatim fallback below
    }
  }

  // ── Priority 2: Google Maps Geocoding API ─────────────────────────────────
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status !== "OK" || !data.results?.length) {
        throw new Error("No results from Google Maps");
      }

      const result = data.results[0];
      const getComponent = (types: string[]) => {
        const comp = result.address_components.find((c: any) =>
          types.some((t) => c.types.includes(t))
        );
        return comp ? comp.long_name : "";
      };

      return {
        house_name: getComponent(["premise", "street_number", "point_of_interest"]) || "",
        street: getComponent(["route"]) || "",
        area: getComponent(["sublocality", "neighborhood"]) || "",
        city: getComponent(["locality", "administrative_area_level_2"]) || "",
        state: getComponent(["administrative_area_level_1"]) || "",
        pincode: getComponent(["postal_code"]) || "",
        display_name: result.formatted_address,
      };
    } catch (err) {
      console.warn("Google Maps geocoding failed, falling back to Nominatim:", err);
      // Fall through to Nominatim fallback below
    }
  }

  // ── Priority 3: OpenStreetMap Nominatim (free fallback) ───────────────────
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "BharatClapApp/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Geocoding API responded with status: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Geocoding error: ${data.error}`);
  }

  const addr = data.address || {};
  const cityName =
    addr.city || addr.town || addr.village || addr.state_district || addr.county || "";
  const placeName =
    addr.amenity || addr.building || addr.shop || addr.office || addr.tourism ||
    addr.historic || addr.leisure || addr.house_name || addr.commercial || addr.retail ||
    addr.industrial || addr.restaurant || addr.cafe || addr.fast_food || addr.hotel || "";
  const houseNo = addr.house_number || "";
  const road = addr.road || addr.pedestrian || addr.footway || "";
  const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.residential || "";

  return {
    house_name: placeName || houseNo || data.display_name?.split(",")[0] || "Detected Location",
    street: road,
    area: area || cityName,
    city: cityName,
    state: addr.state || "",
    pincode: addr.postcode || "",
    display_name: data.display_name || "Detected location",
  };
};
