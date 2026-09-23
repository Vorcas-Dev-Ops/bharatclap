import { getDb } from '../../config/db';

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
    subserviceId?: string,
    providerId?: string
  ): Promise<BufferSettings> {
    let globalSetting: any = null;
    try {
      const res = await getDb().query('SELECT settings FROM provider.dispatch_settings LIMIT 1');
      globalSetting = res.rows[0]?.settings ?? null;
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
   * against provider.provider_calendar_blocks.
   */
  public async canBookingFit(
    providerId: string,
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
    try {
      const blockDate = bookingStart.toISOString().split('T')[0];
      const res = await getDb().query(
        `SELECT id, reason, start_time, end_time 
         FROM provider.provider_calendar_blocks 
         WHERE (provider_id = $1::uuid OR legacy_mongo_id = $1)
           AND block_date = $2`,
        [providerId, blockDate]
      );
      overlappingBlocks = res.rows;
    } catch (_) {}

    if (overlappingBlocks.length > 0) {
      // Check time overlap if start_time / end_time are present
      const reqStart = candidateTravelStart.toISOString().slice(11, 16); // "HH:MM"
      const reqEnd = candidateCleanupEnd.toISOString().slice(11, 16);     // "HH:MM"

      const hasConflict = overlappingBlocks.some(b => {
        if (!b.start_time || !b.end_time) return true;
        return (b.start_time < reqEnd && b.end_time > reqStart);
      });

      if (hasConflict) {
        const conflictingTypes = overlappingBlocks.map(b => b.reason || 'blocked').join(', ');
        return {
          fits: false,
          requiredAvailabilityTime,
          candidateTravelStart,
          candidateCleanupEnd,
          conflictReason: `Overlaps with existing calendar block(s): ${conflictingTypes}`
        };
      }
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
    providerId: string,
    bookingId: string,
    bookingStart: Date,
    durationMinutes: number,
    travelMinutes: number,
    buffers: BufferSettings,
    locationCoords?: [number, number]
  ): Promise<void> {
    const bookingStartMs = bookingStart.getTime();

    const travelStart = new Date(bookingStartMs - (travelMinutes + buffers.safetyBufferMinutes) * 60 * 1000);
    const serviceEnd = new Date(bookingStartMs + durationMinutes * 60 * 1000);
    const cleanupEnd = new Date(serviceEnd.getTime() + buffers.cleanupBufferMinutes * 60 * 1000);

    const blockDate = bookingStart.toISOString().split('T')[0];
    const travelStartTime = travelStart.toISOString().slice(11, 16);
    const serviceEndTime = serviceEnd.toISOString().slice(11, 16);
    const cleanupEndTime = cleanupEnd.toISOString().slice(11, 16);

    try {
      await getDb().query(
        `INSERT INTO provider.provider_calendar_blocks (provider_id, block_date, start_time, end_time, reason)
         VALUES 
           ($1::uuid, $2, $3, $4, $5),
           ($1::uuid, $2, $4, $6, $7),
           ($1::uuid, $2, $6, $8, $9)`,
        [
          providerId, blockDate,
          travelStartTime, bookingStart.toISOString().slice(11, 16), `travel:${bookingId}`,
          serviceEndTime, `booking:${bookingId}`,
          cleanupEndTime, `cleanup:${bookingId}`
        ]
      );
    } catch (err) {
      console.error('Failed to create calendar blocks:', err);
    }
  }

  /**
   * Release all calendar blocks for a cancelled or rejected booking.
   */
  public async releaseBookingCalendarBlocks(bookingId: string): Promise<void> {
    try {
      await getDb().query(
        `DELETE FROM provider.provider_calendar_blocks 
         WHERE reason LIKE $1`,
        [`%:${bookingId}`]
      );
    } catch (err) {
      console.error('Failed to release calendar blocks:', err);
    }
  }
}

export const scheduleEngine = new ScheduleEngine();
