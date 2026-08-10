import axios from 'axios';
import { IRoutingProvider, Coordinates, TravelEstimate } from './IRoutingProvider';

export class OSRMRoutingProvider implements IRoutingProvider {
  name = 'osrm';
  private baseUrl: string;

  constructor(baseUrl: string = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getTravelEstimate(origin: Coordinates, destination: Coordinates): Promise<TravelEstimate> {
    const url = `${this.baseUrl}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`;
    
    const response = await axios.get(url, { timeout: 3000 });
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const distanceMeters = Math.round(route.distance);
      const durationMinutes = Math.max(5, Math.ceil(route.duration / 60));

      return {
        distanceMeters,
        durationMinutes,
        confidenceScore: 95,
        providerName: this.name
      };
    }

    throw new Error('OSRM returned no valid route');
  }
}
