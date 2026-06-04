import { Request, Response } from 'express';
import { AdminReport } from '../models/AdminReport';

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private/Admin
export const getReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await AdminReport.find().sort({ createdAt: -1 });
    res.json(reports);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create report
// @route   POST /api/reports
// @access  Private/Admin
export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type, data_json } = req.body;
    const report = await AdminReport.create({ type, data_json });
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private/Admin
export const deleteReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await AdminReport.findByIdAndDelete(req.params.id);
    if (!report) {
      res.status(404).json({ message: 'Report not found' });
      return;
    }
    res.json({ message: 'Report deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
