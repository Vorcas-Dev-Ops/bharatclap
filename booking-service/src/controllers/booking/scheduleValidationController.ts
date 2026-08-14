import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import { Cart } from '../../models/Cart';
import { getCatalogBatch } from '../../utils/internalApi';

const PROVIDER_SERVICE_URL = process.env.PROVIDER_SERVICE_URL || 'http://127.0.0.1:5003';
const HMAC_SECRET = process.env.JWT_SECRET || 'bharatclap-schedule-token-secret';
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateScheduleToken(
  userId: string,
  addressId: string,
  mode: string,
  prefDate: string,
  prefStart: string,
  timelineStr: string,
  expiresAt: number
): string {
  const payload = `${userId}:${addressId}:${mode}:${prefDate}:${prefStart}:${timelineStr}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

export function verifyScheduleToken(
  token: string,
  userId: string,
  addressId: string,
  mode: string,
  prefDate: string,
  prefStart: string,
  timelineStr: string
): boolean {
  if (!token || !token.includes('.')) return false;
  const [expiresAtStr, hmac] = token.split('.');
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedToken = generateScheduleToken(userId, addressId, mode, prefDate, prefStart, timelineStr, expiresAt);
  return token === expectedToken;
}

// Convert "10:00 AM" → Date object on given date string "YYYY-MM-DD"
function parseSlotToDate(dateStr: string, timeStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  const match = String(timeStr).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3] ? match[3].toLowerCase() : null;
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    d.setHours(h, m, 0, 0);
  }
  return d;
}

// Format Date object to "10:00 AM" display label
function formatDateToSlot(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  return strTime;
}

// @desc    Validate multi-service timeline & verify provider availability before checkout
// @route   POST /api/bookings/validate-schedule
// @access  Private
export const validateSchedule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    const {
      address_id,
      preferred_date,
      preferred_start_time,
      scheduling_mode = 'sequential'
    } = req.body;

    const cart = await Cart.findOne({ user_id: new mongoose.Types.ObjectId(userId) });
    if (!cart || !cart.items || cart.items.length === 0) {
      res.status(400).json({ available: false, message: 'Cart is empty' });
      return;
    }

    const targetDate = preferred_date || cart.preferred_date || new Date().toISOString().split('T')[0];
    const targetStartTime = preferred_start_time || cart.preferred_start_time || '10:00 AM';
    const mode = scheduling_mode || cart.scheduling_mode || 'sequential';

    // Fetch catalog batch for duration rules
    const subserviceIds = [...new Set(cart.items.map(i => String(i.subservice_id)))];
    const catalogData = await getCatalogBatch(subserviceIds, [], [], []);
    const subserviceMap = new Map(catalogData.subservices.map((s: any) => [String(s._id), s]));

    const calculatedItems: any[] = [];
    const timeline: any[] = [];
    let currentPointer = parseSlotToDate(targetDate, targetStartTime);

    for (let idx = 0; idx < cart.items.length; idx++) {
      const item = cart.items[idx];
      const subservice: any = subserviceMap.get(String(item.subservice_id));
      const baseDuration = subservice?.duration_minutes || subservice?.duration || 60;
      // Catalog-driven effective duration (base_duration * quantity)
      const effectiveDuration = baseDuration * (item.quantity || 1);

      let itemStart: Date;
      let itemTimeSlot: string;

      if (mode === 'custom' && item.selected_date && item.selected_time_slot) {
        itemStart = parseSlotToDate(item.selected_date, item.selected_time_slot.split('-')[0].trim());
        itemTimeSlot = item.selected_time_slot;
      } else {
        itemStart = new Date(currentPointer.getTime());
        const itemEndPointer = new Date(itemStart.getTime() + effectiveDuration * 60 * 1000);
        itemTimeSlot = `${formatDateToSlot(itemStart)} - ${formatDateToSlot(itemEndPointer)}`;
      }

      const itemEnd = new Date(itemStart.getTime() + effectiveDuration * 60 * 1000);

      // Dynamic transition breakdown (safety buffer + estimated travel)
      const travelMinutes = 5;
      const safetyBufferMinutes = 10;
      const transitionMinutes = travelMinutes + safetyBufferMinutes;

      calculatedItems.push({
        subservice_id: String(item.subservice_id),
        subservice_name: subservice?.subservice_name || 'Service',
        quantity: item.quantity,
        scheduled_at: itemStart.toISOString(),
        booking_time: itemTimeSlot,
        duration_minutes: effectiveDuration,
        travel_minutes: travelMinutes,
        safety_buffer_minutes: safetyBufferMinutes,
      });

      timeline.push({
        type: 'service',
        subservice_id: String(item.subservice_id),
        subservice_name: subservice?.subservice_name || 'Service',
        quantity: item.quantity,
        start_time: formatDateToSlot(itemStart),
        end_time: formatDateToSlot(itemEnd),
        duration_minutes: effectiveDuration
      });

      // Update currentPointer for next item in sequential timeline
      currentPointer = new Date(itemEnd.getTime() + transitionMinutes * 60 * 1000);

      if (idx < cart.items.length - 1 && mode === 'sequential') {
        timeline.push({
          type: 'transition',
          travel_minutes: travelMinutes,
          safety_buffer_minutes: safetyBufferMinutes,
          travel_buffer_minutes: transitionMinutes,
          label: `Travel (${travelMinutes}m) + Prep Buffer (${safetyBufferMinutes}m)`
        });
      }
    }

    // Query Provider-Service for multi-schedule feasibility
    let isAvailable = true;
    let candidateCount = 0;
    let failureReason = '';

    try {
      const response = await axios.post(`${PROVIDER_SERVICE_URL}/api/providers/internal/validate-multi-schedule`, {
        subservice_ids: subserviceIds,
        items: calculatedItems,
        address_id
      }, { timeout: 8000 });

      isAvailable = response.data?.available === true;
      candidateCount = response.data?.candidate_count || 0;
      failureReason = response.data?.reason || '';
    } catch (err: any) {
      console.warn('[VALIDATE_SCHEDULE] Provider check warning, defaulting to available for preview:', err.message);
      isAvailable = true;
    }

    const timelineStr = JSON.stringify(timeline.map(t => `${t.subservice_id || t.type}:${t.start_time || ''}:${t.end_time || ''}`));
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const scheduleToken = generateScheduleToken(
      String(userId),
      String(address_id || 'default'),
      mode,
      targetDate,
      targetStartTime,
      timelineStr,
      expiresAt
    );

    if (!isAvailable) {
      res.status(200).json({
        available: false,
        reason: failureReason || 'Providers in your area are busy during the requested time window.',
        suggested_start_times: ['10:30 AM', '11:00 AM', '11:30 AM', '02:00 PM'],
        timeline
      });
      return;
    }

    res.json({
      available: true,
      candidate_count: candidateCount,
      schedule_token: scheduleToken,
      expires_at: expiresAt,
      preferred_date: targetDate,
      preferred_start_time: targetStartTime,
      scheduling_mode: mode,
      timeline
    });
  } catch (error: any) {
    res.status(500).json({ available: false, message: error.message });
  }
};
