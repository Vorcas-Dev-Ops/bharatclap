import express from 'express';
import {
  getTimeSlotRules,
  createTimeSlotRule,
  updateTimeSlotRule,
  deleteTimeSlotRule,
  toggleTimeSlotRule
} from '../controllers/timeSlotController';

const router = express.Router();

router.get('/', getTimeSlotRules);
router.post('/', createTimeSlotRule);
router.put('/:id', updateTimeSlotRule);
router.delete('/:id', deleteTimeSlotRule);
router.patch('/:id/toggle', toggleTimeSlotRule);

export default router;
