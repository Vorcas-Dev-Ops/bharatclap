import { Request, Response } from 'express';
import { LocationRepository } from '../repositories/locationRepository';

// @desc    Get all locations
// @route   GET /api/locations
// @access  Public
export const getLocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = (req.query.status as string) || 'active';
    const city = req.query.city as string;
    const search = req.query.search as string;

    const locations = await LocationRepository.findLocations({ status, city, search });
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
    const location = await LocationRepository.findById(req.params.id);
    if (!location) {
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
    const { name, city, state, pincode, status, latitude, longitude, serviceRadius } = req.body;

    if (!name || !city || !state) {
      res.status(400).json({ message: 'Name, city, and state are required' });
      return;
    }

    const location = await LocationRepository.create({
      name,
      city,
      state,
      pincode,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      serviceRadius: serviceRadius ? Number(serviceRadius) : 10000,
      status: status || 'active',
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
    const location = await LocationRepository.findById(req.params.id);
    if (!location) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }

    const updated = await LocationRepository.update(req.params.id, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a location (Soft Delete)
// @route   DELETE /api/locations/:id
// @access  Private/Admin
export const deleteLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const location = await LocationRepository.findById(req.params.id);
    if (!location) {
      res.status(404).json({ message: 'Location not found' });
      return;
    }

    await LocationRepository.delete(req.params.id);
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
    const locations = await LocationRepository.findByIds(ids);
    res.json(locations);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
