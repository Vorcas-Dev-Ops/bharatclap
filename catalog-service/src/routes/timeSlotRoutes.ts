import express from 'express';
import {
  getTimeSlotRules,
  createTimeSlotRule,
  updateTimeSlotRule,
  deleteTimeSlotRule,
  toggleTimeSlotRule,
  getAvailableTimeSlotsWithSurcharges,
  simulateRuleEvaluation
} from '../controllers/timeSlotController';

const router = express.Router();

router.get('/', getTimeSlotRules);
router.get('/available', getAvailableTimeSlotsWithSurcharges);
router.post('/admin/simulate', simulateRuleEvaluation);
router.post('/', createTimeSlotRule);
router.put('/:id', updateTimeSlotRule);
router.delete('/:id', deleteTimeSlotRule);
router.patch('/:id/toggle', toggleTimeSlotRule);

export default router;

