import { IRoutingProvider, Coordinates, TravelEstimate } from './IRoutingProvider';

export class HaversineRoutingProvider implements IRoutingProvider {
  name = 'haversine';
  private urbanSpeedKmh: number;

  constructor(urbanSpeedKmh: number = 25) {
    this.urbanSpeedKmh = urbanSpeedKmh;
  }

  async getTravelEstimate(origin: Coordinates, destination: Coordinates): Promise<TravelEstimate> {
    const R = 6371000; // meters
    const dLat = (destination.lat - origin.lat) * (Math.PI / 180);
    const dLon = (destination.lng - origin.lng) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(origin.lat * (Math.PI / 180)) *
        Math.cos(destination.lat * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDistanceMeters = Math.round(R * c);

    // ponytail: road winding factor ~1.3x straight-line distance
    const roadDistanceMeters = Math.round(straightDistanceMeters * 1.3);

    // ponytail: urban traffic calculation (speed in m/s) + 5 min base turn/signal buffer
    const speedMps = (this.urbanSpeedKmh * 1000) / 3600;
    const drivingSeconds = Math.round(roadDistanceMeters / speedMps);
    const totalMinutes = Math.max(5, Math.ceil((drivingSeconds / 60) + 5));

    return {
      distanceMeters: roadDistanceMeters,
      durationMinutes: totalMinutes,
      confidenceScore: 85,
      providerName: this.name
    };
  }
}
