import { Request, Response } from 'express';
import { TimeSlotRepository } from '../repositories/timeSlotRepository';
import { evaluateTimeSlotRules } from '../services/ruleEvaluationService';

const STANDARD_TIME_SLOTS = [
  "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"
];

// GET all rules (optionally filter by categoryId or status)
export const getTimeSlotRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, status } = req.query;
    const rules = await TimeSlotRepository.find({
      categoryId: categoryId as string,
      status: status as string,
    });
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/timeslot-rules/available
// Evaluates active rules for a category across all standard time slots
export const getAvailableTimeSlotsWithSurcharges = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, subserviceId, city, date, basePrice } = req.query;
    const numericBasePrice = Number(basePrice) || 0;
    const targetDate = date ? new Date(date as string) : new Date();

    const rules = await TimeSlotRepository.findActiveRules();

    const slotsResult = STANDARD_TIME_SLOTS.map(slot => {
      const evalRes = evaluateTimeSlotRules(rules as any, {
        slotTime: slot,
        basePrice: numericBasePrice,
        categoryId: categoryId as string,
        subserviceId: subserviceId as string,
        city: city as string,
        date: targetDate
      });

      return {
        slot,
        extraCharge: evalRes.netSlotSurcharge,
        totalExtraCharge: evalRes.totalExtraCharge,
        totalDiscount: evalRes.totalDiscount,
        isPeak: evalRes.isPeak,
        appliedRules: evalRes.appliedRules
      };
    });

    res.json(slotsResult);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/timeslot-rules/admin/simulate
// Admin sandbox simulator testing rule evaluation
export const simulateRuleEvaluation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slotTime, basePrice, categoryId, subserviceId, city, date } = req.body;

    if (!slotTime) {
      res.status(400).json({ message: 'slotTime is required for simulation' });
      return;
    }

    const rules = await TimeSlotRepository.find();

    const evaluation = evaluateTimeSlotRules(rules as any, {
      slotTime,
      basePrice: Number(basePrice) || 0,
      categoryId,
      subserviceId,
      city,
      date: date ? new Date(date) : new Date()
    });

    res.json({
      slotTime,
      basePrice: Number(basePrice) || 0,
      evaluation
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST create a new rule
export const createTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRepository.create(req.body);

    const adminUser = (req as any).user || {};
    await TimeSlotRepository.recordAudit({
      ruleId: rule.id,
      fieldChanged: 'created',
      newValue: rule,
      changedBy: adminUser._id || adminUser.id,
    });

    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update a rule (with versioning & audit log)
export const updateTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingRule = await TimeSlotRepository.findById(req.params.id);
    if (!existingRule) {
      res.status(404).json({ message: 'Rule not found' });
      return;
    }

    const updatedRule = await TimeSlotRepository.update(req.params.id, req.body);

    const adminUser = (req as any).user || {};
    await TimeSlotRepository.recordAudit({
      ruleId: req.params.id,
      fieldChanged: 'updated',
      oldValue: existingRule,
      newValue: updatedRule,
      changedBy: adminUser._id || adminUser.id,
    });

    res.json(updatedRule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE a rule (soft delete to archived)
export const deleteTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingRule = await TimeSlotRepository.findById(req.params.id);
    if (!existingRule) {
      res.status(404).json({ message: 'Rule not found' });
      return;
    }

    await TimeSlotRepository.update(req.params.id, { isActive: false, status: 'archived' });

    const adminUser = (req as any).user || {};
    await TimeSlotRepository.recordAudit({
      ruleId: req.params.id,
      fieldChanged: 'status',
      oldValue: existingRule.status,
      newValue: 'archived',
      changedBy: adminUser._id || adminUser.id,
    });

    res.json({ message: 'Rule archived successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH toggle isActive
export const toggleTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingRule = await TimeSlotRepository.findById(req.params.id);
    if (!existingRule) {
      res.status(404).json({ message: 'Rule not found' });
      return;
    }

    const newActive = !existingRule.isActive;
    const updated = await TimeSlotRepository.update(req.params.id, { isActive: newActive });

    const adminUser = (req as any).user || {};
    await TimeSlotRepository.recordAudit({
      ruleId: req.params.id,
      fieldChanged: 'is_active',
      oldValue: existingRule.isActive,
      newValue: newActive,
      changedBy: adminUser._id || adminUser.id,
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
