import { Request, Response } from 'express';
import { StarterKit } from '../models/StarterKit';
import { saveFileToCloud } from '../utils/fileHelper';

export const getStarterKits = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const kits = await StarterKit.find({ isDeleted: false })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json(kits);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const createStarterKit = async (req: Request, res: Response) => {
  try {
    const kit = new StarterKit(req.body);
    await kit.save();
    res.status(201).json(kit);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const updateStarterKit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };

    if (updateData.images) {
      const slots = ['banner', 'tshirt', 'bag', 'idcard', 'kit'];
      for (const slot of slots) {
        if (updateData.images[slot] && updateData.images[slot].startsWith('data:image')) {
          const uploadRes = await saveFileToCloud(updateData.images[slot], 'starter-kits');
          updateData.images[slot] = uploadRes.secure_url;
        }
      }
    }

    const kit = await StarterKit.findByIdAndUpdate(id, updateData, { new: true });
    if (!kit) return res.status(404).json({ message: 'Not found' });
    res.json(kit);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};

export const deleteStarterKit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const kit = await StarterKit.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if (!kit) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Starter kit soft deleted successfully', kit });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error });
  }
};
