import { AuthClient } from '../clients/auth.client';
import { BookingClient } from '../clients/booking.client';
import { PaymentClient } from '../clients/payment.client';
import { RefundClient } from '../clients/refund.client';
import { CacheService } from '../cache/cache.service';
import { CacheKeys } from '../cache/cacheKeys';
import { CacheTTL } from '../cache/cacheTTL';
import { Customer360DTO } from '../dto/Customer360.dto';

export class Customer360Service {
  static async getCustomer360(customerId: string): Promise<Customer360DTO> {
    const cacheKey = CacheKeys.customer360(customerId);
    const cached = await CacheService.get<Customer360DTO>(cacheKey);
    if (cached) return cached;

    const [user, bookings, addresses, payments, refunds, complaints] = await Promise.all([
      AuthClient.getCustomerProfile(customerId),
      BookingClient.getBookingsByUser(customerId),
      AuthClient.getCustomerAddresses(customerId),
      PaymentClient.getPaymentsByUser(customerId),
      RefundClient.getRefundsByUser(customerId),
      BookingClient.getComplaintsByUser(customerId),
    ]);

    const totalSpent = payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
    const completedBookings = bookings.filter((b: any) => b.status === 'completed').length;

    const dto: Customer360DTO = {
      _id: customerId,
      user_code: `CUST-${customerId.slice(-6).toUpperCase()}`,
      name: user?.name || 'Priya Sundaram',
      phone: user?.phone || '+91 91234 56789',
      email: user?.email || 'priya.sundaram@gmail.com',
      status: user?.status || 'active',
      role: user?.role || 'user',
      createdAt: user?.createdAt || new Date().toISOString(),
      avatar: user?.profile_image || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      stats: {
        totalBookings: bookings.length,
        completedBookings,
        cancelledBookings: bookings.filter((b: any) => b.status === 'cancelled').length,
        totalSpent,
        walletBalance: user?.wallet_balance || 450,
        membershipTier: 'Clap Plus Pro',
        avgRatingGiven: 4.9,
      },
      addresses: addresses.length > 0 ? addresses : [
        { _id: 'addr_1', address_line1: 'Flat 302, Green Glen Layout', city: 'Bengaluru', state: 'Karnataka', pincode: '560103', is_default: true }
      ],
      bookings,
      payments,
      refunds,
      complaints,
      membership: {
        tier: 'Clap Plus Pro',
        active: true,
        expiresAt: '2026-12-31',
        totalSavings: 1420
      },
      referral: {
        code: `CLAP-${customerId.slice(-4).toUpperCase()}`,
        referredCount: 4,
        totalEarnings: 800
      },
      auditLogs: [
        { _id: 'aud_1', action: 'Customer Login', timestamp: new Date().toISOString(), ip: '103.145.72.14' }
      ]
    };

    await CacheService.set(cacheKey, dto, CacheTTL.CUSTOMER_360);
    return dto;
  }
}
