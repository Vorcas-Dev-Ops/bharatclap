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

export const reverseGeocode = async (lat: number, lng: number): Promise<GeocodeResult> => {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API Key is missing");
  }

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
  );
  const data = await response.json();

  if (data.status !== "OK" || !data.results?.length) {
    throw new Error("No results from Google Maps");
  }

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

  const house_no_building = getComponent(["street_number", "premise", "point_of_interest"]) || "";
  const address_line_1 = getComponent(["route"]) || "";
  const area_locality = getComponent(["sublocality", "neighborhood"]) || "";
  const city = getComponent(["locality"]) || "";
  const district = getComponent(["administrative_area_level_2"]) || city;
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
    
    // Legacy mapping
    house_name: house_no_building,
    street: address_line_1,
    area: area_locality,
    display_name: formatted_address,
  };
};
