/**
 * Central Source of Truth for Serviceable Cities in BharatClap.
 *
 * Current Production State:
 * - Bengaluru is the ONLY active/operational city.
 *
 * Future Expansion:
 * - To launch and activate a new city (e.g. Mumbai, Hyderabad), set its `active` flag
 *   to `true` and `status` to `'active'`.
 * - The entire UI (Navbar selector, Hero, Footer, Address selection, and Booking validation)
 *   reads from this configuration, automatically activating the new city across the platform.
 */

export interface ServiceCity {
  id: string;
  name: string;
  state: string;
  active: boolean;
  status: 'active' | 'coming_soon';
  badge?: string;
  isDefault?: boolean;
}

export const SERVICE_CITIES: ServiceCity[] = [
  {
    id: "bengaluru",
    name: "Bengaluru",
    state: "Karnataka",
    active: true,
    status: "active",
    badge: "Active",
    isDefault: true,
  },
  {
    id: "mumbai",
    name: "Mumbai",
    state: "Maharashtra",
    active: false,
    status: "coming_soon",
    badge: "Coming Soon",
  },
  {
    id: "delhi-ncr",
    name: "Delhi NCR",
    state: "Delhi",
    active: false,
    status: "coming_soon",
    badge: "Coming Soon",
  },
  {
    id: "hyderabad",
    name: "Hyderabad",
    state: "Telangana",
    active: false,
    status: "coming_soon",
    badge: "Coming Soon",
  },
  {
    id: "pune",
    name: "Pune",
    state: "Maharashtra",
    active: false,
    status: "coming_soon",
    badge: "Coming Soon",
  },
  {
    id: "chennai",
    name: "Chennai",
    state: "Tamil Nadu",
    active: false,
    status: "coming_soon",
    badge: "Coming Soon",
  },
];

/**
 * Returns all active cities where services are currently operational and bookable.
 */
export const getActiveCities = (): ServiceCity[] => {
  return SERVICE_CITIES.filter((city) => city.active);
};

/**
 * Returns cities planned for upcoming expansion.
 */
export const getComingSoonCities = (): ServiceCity[] => {
  return SERVICE_CITIES.filter((city) => !city.active);
};

/**
 * Returns the primary default operating city (Bengaluru).
 */
export const getDefaultCity = (): ServiceCity => {
  return SERVICE_CITIES.find((city) => city.isDefault) || SERVICE_CITIES[0];
};

/**
 * Checks whether a given city name is currently serviceable.
 * Case-insensitive and normalizes common variations like 'Bangalore' -> 'Bengaluru'.
 */
export const isCityServiceable = (cityName?: string | null): boolean => {
  if (!cityName) return false;
  const normalized = cityName.trim().toLowerCase();
  
  return getActiveCities().some((city) => {
    const cName = city.name.toLowerCase();
    if (city.id === "bengaluru") {
      return (
        normalized === "bengaluru" ||
        normalized === "bangalore" ||
        normalized.includes("bengaluru") ||
        normalized.includes("bangalore")
      );
    }
    return normalized === cName || normalized.includes(cName);
  });
};
