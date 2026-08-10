import { Request, Response, NextFunction } from 'express';
import { Booking } from '../models/Booking';
import { sendSuccess, sendError, ErrorCodes, NotFoundError, BusinessError } from '@bharatclap/shared';

// ponytail: Haversine distance formula in meters using stdlib Math to avoid external GIS packages
function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const validateProviderArrival = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { providerLat, providerLng, customerLat, customerLng } = req.body;

    if (providerLat === undefined || providerLng === undefined || customerLat === undefined || customerLng === undefined) {
      throw new BusinessError('Provider and Customer GPS coordinates are required', ErrorCodes.VALIDATION_ERROR);
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError('Booking record not found');
    }

    const distanceMeters = calculateHaversineDistanceMeters(
      Number(providerLat),
      Number(providerLng),
      Number(customerLat),
      Number(customerLng)
    );

    if (distanceMeters > 100) {
      sendError(res, 400, `Arrival failed: You are ${Math.round(distanceMeters)} meters away. Arrival requires being within 100 meters of the customer location.`, ErrorCodes.VALIDATION_ERROR);
      return;
    }

    booking.status = 'arrived';
    booking.provider_arrival_time = new Date();
    await booking.save();

    sendSuccess(res, 200, 'Arrival validated successfully (within 100m)', {
      arrived: true,
      distanceMeters: Math.round(distanceMeters),
      bookingStatus: booking.status,
      navigationUrl: `https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}`
    });
  } catch (err) {
    next(err);
  }
};
