import { Request, Response } from 'express';
import { TimeSlotRule } from '../models/TimeSlotRule';
import { TimeSlotPricingAudit } from '../models/TimeSlotPricingAudit';
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
    const filter: any = {};
    if (categoryId) filter.categoryId = categoryId;
    if (status && status !== 'all') filter.status = status;
    else filter.status = { $ne: 'archived' };

    const rules = await TimeSlotRule.find(filter).sort({ priority: -1, createdAt: -1 });
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

    const rules = await TimeSlotRule.find({
      isActive: true,
      status: 'active'
    }).lean();

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

    const rules = await TimeSlotRule.find({ status: { $ne: 'archived' } }).lean();

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
    const ruleData = { ...req.body, version: 1 };
    const rule = await TimeSlotRule.create(ruleData);

    const adminUser = (req as any).user || {};
    await TimeSlotPricingAudit.create({
      ruleId: rule._id,
      version: 1,
      action: 'create',
      afterState: rule.toObject(),
      adminId: adminUser._id || adminUser.id || 'admin',
      adminName: adminUser.name || 'Admin',
      reason: req.body.auditReason || 'Created new time slot rule'
    });

    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update a rule (with versioning & audit log)
export const updateTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const existingRule = await TimeSlotRule.findById(req.params.id);
    if (!existingRule) { res.status(404).json({ message: 'Rule not found' }); return; }

    const beforeState = existingRule.toObject();
    const newVersion = (existingRule.version || 1) + 1;

    Object.assign(existingRule, req.body, { version: newVersion });
    const updatedRule = await existingRule.save();

    const adminUser = (req as any).user || {};
    await TimeSlotPricingAudit.create({
      ruleId: updatedRule._id,
      version: newVersion,
      action: 'update',
      beforeState,
      afterState: updatedRule.toObject(),
      adminId: adminUser._id || adminUser.id || 'admin',
      adminName: adminUser.name || 'Admin',
      reason: req.body.auditReason || 'Updated time slot rule details'
    });

    res.json(updatedRule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE a rule (soft delete to archived)
export const deleteTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.findById(req.params.id);
    if (!rule) { res.status(404).json({ message: 'Rule not found' }); return; }

    const beforeState = rule.toObject();
    rule.status = 'archived';
    rule.isActive = false;
    await rule.save();

    const adminUser = (req as any).user || {};
    await TimeSlotPricingAudit.create({
      ruleId: rule._id,
      version: rule.version,
      action: 'archived',
      beforeState,
      adminId: adminUser._id || adminUser.id || 'admin',
      adminName: adminUser.name || 'Admin',
      reason: 'Archived time slot rule'
    });

    res.json({ message: 'Rule archived successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH toggle isActive
export const toggleTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.findById(req.params.id);
    if (!rule) { res.status(404).json({ message: 'Rule not found' }); return; }

    const beforeState = rule.toObject();
    rule.isActive = !rule.isActive;
    rule.status = rule.isActive ? 'active' : 'disabled';
    rule.version = (rule.version || 1) + 1;
    await rule.save();

    const adminUser = (req as any).user || {};
    await TimeSlotPricingAudit.create({
      ruleId: rule._id,
      version: rule.version,
      action: 'toggle',
      beforeState,
      afterState: rule.toObject(),
      adminId: adminUser._id || adminUser.id || 'admin',
      adminName: adminUser.name || 'Admin',
      reason: `Toggled rule active status to ${rule.isActive}`
    });

    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

