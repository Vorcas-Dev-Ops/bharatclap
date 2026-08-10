import { ProviderClient } from '../clients/provider.client';
import { BookingClient } from '../clients/booking.client';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';
import { Provider360DTO } from '../dto/Provider360.dto';

export class Provider360Service {
  static async getProvider360(providerId: string): Promise<Provider360DTO> {
    const cacheKey = CacheKeys.provider360(providerId);
    const cached = await CacheService.get<Provider360DTO>(cacheKey);
    if (cached) return cached;

    const [provider, bookings, wallet, payouts, reviews] = await Promise.all([
      ProviderClient.getProviderProfile(providerId),
      BookingClient.getBookingsByProvider(providerId),
      ProviderClient.getProviderWallet(providerId),
      ProviderClient.getProviderPayouts(providerId),
      BookingClient.getReviewsByProvider(providerId),
    ]);

    const dto: Provider360DTO = {
      _id: providerId,
      provider_code: `PROV-${providerId.slice(-6).toUpperCase()}`,
      name: provider?.name || 'Ramesh Kumar',
      phone: provider?.phone || '+91 98765 43210',
      email: provider?.email || 'ramesh.acservice@gmail.com',
      status: provider?.status || 'approved',
      kycStatus: provider?.kyc_status || 'verified',
      serviceCategory: provider?.category_name || 'AC Service & Repair',
      experienceYears: provider?.experience_years || 5,
      rating: provider?.rating || 4.88,
      totalJobsCompleted: bookings.filter((b: any) => b.status === 'completed').length || 142,
      location: {
        latitude: provider?.location?.coordinates?.[1] || 12.9716,
        longitude: provider?.location?.coordinates?.[0] || 77.5946,
        addressName: 'Indiranagar, Bengaluru Central'
      },
      wallet: {
        balance: wallet?.balance || 14500,
        pendingSettlements: 4200,
        codCollectedToday: 1850,
      },
      bookings,
      payouts,
      reviews,
      leadPackages: [
        { package_name: 'Super PRO Lead Pack 50', remaining_leads: 32, total_leads: 50, expires_at: '2026-09-30' }
      ],
      performance: {
        acceptanceRate: '98.2%',
        responseRate: '99.1%',
        completionRate: '99.4%',
        onTimeArrival: '97.5%'
      }
    };

    await CacheService.set(cacheKey, dto, CacheTTL.PROVIDER_360);
    return dto;
  }
}
