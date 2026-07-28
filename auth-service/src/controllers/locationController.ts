import { Request, Response } from 'express';
import { Location } from '../models/Location';

// @desc    Get all locations
// @route   GET /api/locations
// @access  Public
export const getLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { isDeleted: false };
    if (req.query.parent_id) filter.parent_id = req.query.parent_id;
    if (req.query.type) filter.type = req.query.type;

    const locations = await Location.find(filter)
      .populate('parent_id')
      .sort({ createdAt: -1 })
      .lean();

    res.json(locations);
  } catch (error: any) {
    console.error('[locationController] getLocations error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get location by ID
// @route   GET /api/locations/:id
// @access  Public
export const getLocationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.findById(req.params.id).populate('parent_id');
    if (!location || location.isDeleted) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }
    res.json(location);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new location
// @route   POST /api/locations
// @access  Private/Admin
export const createLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, type, parent_id, pincode, status, latitude, longitude } = req.body;

    if (!['city', 'area'].includes(type)) {
      res.status(400).json({ message: 'Type must be city or area' });
      return;
    }

    const orConditions: any[] = [
      { name: { $regex: new RegExp(`^${name}$`, 'i') } },
      { 'coordinates.coordinates': [longitude || 0, latitude || 0] }
    ];

    if (pincode && pincode.trim() !== '') {
      orConditions.push({ pincode: pincode.trim() });
    }

    const existingLocation = await Location.findOne({ 
      type, 
      isDeleted: false,
      ...(parent_id ? { parent_id } : {}),
      $or: orConditions
    });
    
    if (existingLocation) {
      res.status(400).json({ message: 'A location with this name, pincode, or exact coordinates already exists.' });
      return;
    }

    const location = await Location.create({
      name,
      type,
      parent_id: parent_id || null,
      pincode,
      status: status || 'active',
      coordinates: {
        type: 'Point',
        coordinates: [longitude || 0, latitude || 0]
      }
    });

    res.status(201).json(location);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a location
// @route   PUT /api/locations/:id
// @access  Private/Admin
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location || location.isDeleted) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }

    const { name, type, parent_id, pincode, status, latitude, longitude } = req.body;

    location.name = name ?? location.name;
    location.type = type ?? location.type;
    location.parent_id = parent_id !== undefined ? parent_id : location.parent_id;
    location.pincode = pincode ?? location.pincode;
    location.status = status ?? location.status;
    
    if (latitude !== undefined || longitude !== undefined) {
      const lng = longitude ?? (location.coordinates?.coordinates[0] || 0);
      const lat = latitude  ?? (location.coordinates?.coordinates[1] || 0);
      location.coordinates = {
        type: 'Point',
        coordinates: [lng, lat]
      };
    }

    const updatedLocation = await location.save();
    res.json(updatedLocation);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a location (Soft Delete)
// @route   DELETE /api/locations/:id
// @access  Private/Admin
export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await Location.findById(req.params.id);

    if (!location || location.isDeleted) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }

    location.isDeleted = true;
    location.status = 'inactive';
    await location.save();

    res.json({ message: 'Location removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple locations by IDs (Internal API)
// @route   POST /api/locations/batch
// @access  Public (Internal)
export const getLocationsBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const locations = await Location.find({ _id: { $in: ids } }).lean();
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
