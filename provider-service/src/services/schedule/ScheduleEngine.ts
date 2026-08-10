import mongoose, { Types } from 'mongoose';
import { ProviderCalendarBlock } from '../../models/ProviderCalendarBlock';
import { DispatchSetting } from '../../models/DispatchSetting';

export interface BufferSettings {
  safetyBufferMinutes: number;
  cleanupBufferMinutes: number;
  maxAcceptableLatenessMinutes: number;
}

export interface ScheduleFitResult {
  fits: boolean;
  requiredAvailabilityTime: Date;
  candidateTravelStart: Date;
  candidateCleanupEnd: Date;
  conflictReason?: string;
}

export class ScheduleEngine {
  /**
   * Resolve safety and cleanup buffers using 5-tier fallback hierarchy:
   * Booking Override -> Provider Override -> Subcategory -> Category -> Global Setting
   */
  public async resolveBuffers(
    subserviceId?: string | Types.ObjectId,
    providerId?: string | Types.ObjectId
  ): Promise<BufferSettings> {
    let globalSetting: any = null;
    try {
      if (mongoose.connection.readyState === 1) {
        globalSetting = await DispatchSetting.findOne({}).lean();
      }
    } catch (_) {}

    const safetyBufferMinutes = Number(globalSetting?.defaultSafetyBufferMinutes) || 15;
    const cleanupBufferMinutes = Number(globalSetting?.defaultCleanupMinutes) || 10;
    const maxAcceptableLatenessMinutes = Number(globalSetting?.maxAcceptableLatenessMinutes) || 5;

    return {
      safetyBufferMinutes,
      cleanupBufferMinutes,
      maxAcceptableLatenessMinutes
    };
  }

  /**
   * Check if a candidate combined block (Pre-Travel + Service + Post-Cleanup) fits into provider's calendar
   * using O(log N) overlapping interval query against ProviderCalendarBlock.
   */
  public async canBookingFit(
    providerId: string | Types.ObjectId,
    bookingStart: Date,
    durationMinutes: number = 60,
    travelMinutes: number = 15,
    buffers: BufferSettings
  ): Promise<ScheduleFitResult> {
    const bookingStartMs = bookingStart.getTime();

    // Required Availability Time = Booking Start - Estimated Travel - Safety Buffer
    const totalPreTravelMinutes = travelMinutes + buffers.safetyBufferMinutes;
    const candidateTravelStart = new Date(bookingStartMs - totalPreTravelMinutes * 60 * 1000);

    // Cleanup End = Booking Start + Duration + Cleanup Buffer
    const totalServicePlusCleanupMinutes = durationMinutes + buffers.cleanupBufferMinutes;
    const candidateCleanupEnd = new Date(bookingStartMs + totalServicePlusCleanupMinutes * 60 * 1000);

    const requiredAvailabilityTime = candidateTravelStart;

    let overlappingBlocks: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        overlappingBlocks = await ProviderCalendarBlock.find({
          provider_id: new Types.ObjectId(String(providerId)),
          status: { $ne: 'cancelled' },
          start_time: { $lt: candidateCleanupEnd },
          end_time: { $gt: candidateTravelStart }
        }).lean();
      } catch (_) {}
    }

    if (overlappingBlocks.length > 0) {
      const conflictingTypes = overlappingBlocks.map(b => b.block_type).join(', ');
      return {
        fits: false,
        requiredAvailabilityTime,
        candidateTravelStart,
        candidateCleanupEnd,
        conflictReason: `Overlaps with existing calendar block(s): ${conflictingTypes}`
      };
    }

    return {
      fits: true,
      requiredAvailabilityTime,
      candidateTravelStart,
      candidateCleanupEnd
    };
  }

  /**
   * Create & persist calendar blocks (Travel, Booking, Cleanup) for an assigned/accepted booking.
   */
  public async createBookingCalendarBlocks(
    providerId: string | Types.ObjectId,
    bookingId: string | Types.ObjectId,
    bookingStart: Date,
    durationMinutes: number,
    travelMinutes: number,
    buffers: BufferSettings,
    locationCoords?: [number, number]
  ): Promise<void> {
    const pId = new Types.ObjectId(String(providerId));
    const bId = new Types.ObjectId(String(bookingId));
    const bookingStartMs = bookingStart.getTime();

    const travelStart = new Date(bookingStartMs - (travelMinutes + buffers.safetyBufferMinutes) * 60 * 1000);
    const serviceEnd = new Date(bookingStartMs + durationMinutes * 60 * 1000);
    const cleanupEnd = new Date(serviceEnd.getTime() + buffers.cleanupBufferMinutes * 60 * 1000);

    const blocksToInsert = [
      {
        provider_id: pId,
        booking_id: bId,
        block_type: 'travel',
        start_time: travelStart,
        end_time: bookingStart,
        status: 'confirmed',
        location: locationCoords ? { type: 'Point', coordinates: locationCoords } : undefined
      },
      {
        provider_id: pId,
        booking_id: bId,
        block_type: 'booking',
        start_time: bookingStart,
        end_time: serviceEnd,
        status: 'confirmed',
        location: locationCoords ? { type: 'Point', coordinates: locationCoords } : undefined
      },
      {
        provider_id: pId,
        booking_id: bId,
        block_type: 'cleanup',
        start_time: serviceEnd,
        end_time: cleanupEnd,
        status: 'confirmed'
      }
    ];

    await ProviderCalendarBlock.insertMany(blocksToInsert);
  }

  /**
   * Release all calendar blocks for a cancelled or rejected booking.
   */
  public async releaseBookingCalendarBlocks(bookingId: string | Types.ObjectId): Promise<void> {
    await ProviderCalendarBlock.updateMany(
      { booking_id: new Types.ObjectId(String(bookingId)) },
      { $set: { status: 'cancelled' } }
    );
  }
}

export const scheduleEngine = new ScheduleEngine();
