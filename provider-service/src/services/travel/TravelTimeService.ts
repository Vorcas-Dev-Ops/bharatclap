import { IRoutingProvider, Coordinates, TravelEstimate } from './IRoutingProvider';
import { HaversineRoutingProvider } from './HaversineRoutingProvider';
import { OSRMRoutingProvider } from './OSRMRoutingProvider';

interface CacheEntry {
  estimate: TravelEstimate;
  expiresAt: number;
}

export class TravelTimeService {
  private primaryProvider: IRoutingProvider;
  private fallbackProvider: IRoutingProvider;
  private cache: Map<string, CacheEntry> = new Map();
  private ttlMs: number = 5 * 60 * 1000; // ponytail: 5 min TTL grid cache

  constructor() {
    this.fallbackProvider = new HaversineRoutingProvider();
    if (process.env.OSRM_BASE_URL) {
      this.primaryProvider = new OSRMRoutingProvider();
    } else {
      this.primaryProvider = this.fallbackProvider;
    }
  }

  private getGridKey(coords: Coordinates): string {
    // ponytail: 3 decimal places (~110 meters precision grid cell)
    return `${coords.lng.toFixed(3)},${coords.lat.toFixed(3)}`;
  }

  public async getTravelEstimate(origin: Coordinates, destination: Coordinates): Promise<TravelEstimate> {
    const originKey = this.getGridKey(origin);
    const destKey = this.getGridKey(destination);

    // Identical or extremely close location check
    if (originKey === destKey) {
      return {
        distanceMeters: 200,
        durationMinutes: 5,
        confidenceScore: 99,
        providerName: 'same_location'
      };
    }

    const cacheKey = `${originKey}->${destKey}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return { ...cached.estimate, providerName: `${cached.estimate.providerName}_cached` };
    }

    let estimate: TravelEstimate;
    try {
      estimate = await this.primaryProvider.getTravelEstimate(origin, destination);
    } catch (err) {
      // Automatic fallback if primary fails or times out
      estimate = await this.fallbackProvider.getTravelEstimate(origin, destination);
    }

    this.cache.set(cacheKey, {
      estimate,
      expiresAt: now + this.ttlMs
    });

    return estimate;
  }

  // Clear expired cache entries
  public pruneCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }
}

export const travelTimeService = new TravelTimeService();
