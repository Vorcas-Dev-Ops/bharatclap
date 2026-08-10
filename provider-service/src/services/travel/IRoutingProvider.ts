export interface Coordinates {
  lng: number;
  lat: number;
}

export interface TravelEstimate {
  distanceMeters: number;
  durationMinutes: number;
  confidenceScore: number; // 0 to 100 (%)
  providerName: string;
}

export interface IRoutingProvider {
  name: string;
  getTravelEstimate(origin: Coordinates, destination: Coordinates): Promise<TravelEstimate>;
}
