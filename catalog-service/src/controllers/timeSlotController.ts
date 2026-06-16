import { Request, Response } from 'express';
import { TimeSlotRule } from '../models/TimeSlotRule';

// GET all rules (optionally filter by categoryId)
export const getTimeSlotRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.query;
    const filter = categoryId ? { categoryId } : {};
    const rules = await TimeSlotRule.find(filter).sort({ categoryName: 1, startTime: 1 });
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST create a new rule
export const createTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.create(req.body);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update a rule
export const updateTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) { res.status(404).json({ message: 'Rule not found' }); return; }
    res.json(rule);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE a rule
export const deleteTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.findByIdAndDelete(req.params.id);
    if (!rule) { res.status(404).json({ message: 'Rule not found' }); return; }
    res.json({ message: 'Rule deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH toggle isActive
export const toggleTimeSlotRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await TimeSlotRule.findById(req.params.id);
    if (!rule) { res.status(404).json({ message: 'Rule not found' }); return; }
    rule.isActive = !rule.isActive;
    await rule.save();
    res.json(rule);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
