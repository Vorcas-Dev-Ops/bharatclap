import axios from 'axios';
import axiosRetry from 'axios-retry';
import { PincodeCache } from '../models/PincodeCache';

// Apply retry logic to axios for temporary network failures
axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors and timeouts
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
  }
});

interface GeocodingResult {
  lat: number;
  lng: number;
  displayName?: string;
}

/**
 * Fetch coordinates from pincode using MongoDB Cache, Google Maps API, and OpenStreetMap Nominatim
 */
export const getCoordinatesFromPincode = async (pincode: string): Promise<GeocodingResult | null> => {
  try {
    // 1. Check MongoDB Cache first for instant response
    const cached = await PincodeCache.findOne({ pincode });
    if (cached) {
      return {
        lat: cached.lat,
        lng: cached.lng,
        displayName: cached.displayName
      };
    }

    // 2. Try Google Maps API if the key is available
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleApiKey) {
      try {
        const response = await axios.get(
          `https://maps.googleapis.com/maps/api/geocode/json`,
          {
            params: {
              address: pincode,
              components: 'country:IN',
              key: googleApiKey
            },
            timeout: 5000 // 5-second timeout
          }
        );

        if (response.data.status === 'OK' && response.data.results?.length > 0) {
          const location = response.data.results[0].geometry.location;
          const result: GeocodingResult = {
            lat: location.lat,
            lng: location.lng,
            displayName: response.data.results[0].formatted_address
          };

          // Save to cache
          await PincodeCache.create({
            pincode,
            lat: result.lat,
            lng: result.lng,
            displayName: result.displayName || ''
          });

          return result;
        }
      } catch (googleError: any) {
        console.warn('Google Maps geocoding failed, falling back to Nominatim:', googleError.message);
      }
    }

    // 3. Fallback to OpenStreetMap Nominatim
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        postalcode: pincode,
        country: 'India',
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'BharatClapApp/1.0'
      },
      timeout: 5000 // 5-second timeout to prevent hanging proxy connections
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const parsedResult: GeocodingResult = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name
      };

      // Save to cache
      await PincodeCache.create({
        pincode,
        lat: parsedResult.lat,
        lng: parsedResult.lng,
        displayName: parsedResult.displayName || ''
      });

      return parsedResult;
    }

    return null;
  } catch (error) {
    console.error('Error fetching coordinates from pincode:', error);
    return null;
  }
};
