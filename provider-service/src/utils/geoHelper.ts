/**
 * Haversine distance in meters between two [lng, lat] coordinates
 */
export function calculateDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate speed in km/h between two coordinates with timestamps
 */
export function calculateSpeedKmh(
  coord1: [number, number],
  time1: Date | number,
  coord2: [number, number],
  time2: Date | number
): number {
  const distanceMeters = calculateDistanceMeters(coord1, coord2);
  const timeDiffSeconds = Math.abs(new Date(time2).getTime() - new Date(time1).getTime()) / 1000;
  if (timeDiffSeconds <= 0) return 0;
  return (distanceMeters / timeDiffSeconds) * 3.6;
}
